from fastapi import FastAPI, Query, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from typing import Optional
from datetime import datetime
import logging

from database import connect_db, close_db, get_db
from models import PaginatedArticles, ArticleResponse, DashboardStats, PipelineStatus, AIInsights
from pipeline import run_pipeline
from ai_processor import process_unprocessed_articles
from config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="News Intelligence API",
    description="AI-powered news aggregation and analysis platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Track pipeline state
pipeline_state = {"running": False, "last_run": None, "last_result": None}


async def _run_full_pipeline():
    """Background task: fetch + AI process."""
    pipeline_state["running"] = True
    try:
        fetch_stats = await run_pipeline()
        ai_stats = await process_unprocessed_articles()
        pipeline_state["last_result"] = {**fetch_stats, "ai_processed": ai_stats["processed"]}
        pipeline_state["last_run"] = datetime.utcnow().isoformat()
    except Exception as e:
        logger.error(f"Pipeline error: {e}")
        pipeline_state["last_result"] = {"error": str(e)}
    finally:
        pipeline_state["running"] = False


@app.post("/api/pipeline/run", response_model=PipelineStatus)
async def trigger_pipeline(background_tasks: BackgroundTasks):
    """Trigger the full data pipeline in the background."""
    if pipeline_state["running"]:
        return PipelineStatus(status="running", message="Pipeline is already running")

    background_tasks.add_task(_run_full_pipeline)
    return PipelineStatus(status="started", message="Pipeline started in background")


@app.get("/api/pipeline/status")
async def get_pipeline_status():
    """Get the current pipeline status."""
    return {
        "running": pipeline_state["running"],
        "last_run": pipeline_state["last_run"],
        "last_result": pipeline_state["last_result"],
    }


@app.get("/api/articles", response_model=PaginatedArticles)
async def get_articles(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None),
    sentiment: Optional[str] = Query(None, regex="^(positive|negative|neutral)$"),
    category: Optional[str] = Query(None),
    processed_only: bool = Query(True),
):
    """Get paginated articles with optional search and filters."""
    db = get_db()
    query = {}

    if processed_only:
        query["ai.processed"] = True

    if sentiment:
        query["ai.sentiment"] = sentiment

    if category:
        query["category"] = category

    if search:
        query["$text"] = {"$search": search}

    skip = (page - 1) * page_size
    total = await db.articles.count_documents(query)

    cursor = db.articles.find(query).sort("published_at", -1).skip(skip).limit(page_size)
    raw_articles = await cursor.to_list(length=page_size)

    articles = []
    for doc in raw_articles:
        doc["id"] = str(doc.pop("_id"))
        ai_data = doc.get("ai", {})
        doc["ai"] = AIInsights(**ai_data)
        articles.append(ArticleResponse(**doc))

    return PaginatedArticles(
        articles=articles,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@app.get("/api/articles/{article_id}", response_model=ArticleResponse)
async def get_article(article_id: str):
    """Get a single article by its article_id."""
    db = get_db()
    doc = await db.articles.find_one({"article_id": article_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")
    doc["id"] = str(doc.pop("_id"))
    doc["ai"] = AIInsights(**doc.get("ai", {}))
    return ArticleResponse(**doc)


@app.get("/api/stats", response_model=DashboardStats)
async def get_stats():
    """Get dashboard statistics."""
    db = get_db()

    total = await db.articles.count_documents({})
    positive = await db.articles.count_documents({"ai.sentiment": "positive"})
    negative = await db.articles.count_documents({"ai.sentiment": "negative"})
    neutral = await db.articles.count_documents({"ai.sentiment": "neutral"})
    processed = await db.articles.count_documents({"ai.processed": True})

    # Category distribution
    cat_pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    cat_cursor = db.articles.aggregate(cat_pipeline)
    categories = {doc["_id"] or "general": doc["count"] async for doc in cat_cursor}

    # Source distribution
    src_pipeline = [
        {"$group": {"_id": "$source_name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    src_cursor = db.articles.aggregate(src_pipeline)
    sources = {doc["_id"] or "unknown": doc["count"] async for doc in src_cursor}

    # Last fetched
    latest = await db.articles.find_one({}, sort=[("created_at", -1)])
    last_fetched = latest["created_at"] if latest else None

    return DashboardStats(
        total_articles=total,
        positive_count=positive,
        negative_count=negative,
        neutral_count=neutral,
        categories=categories,
        sources=sources,
        processed_count=processed,
        last_fetched=last_fetched,
    )


@app.get("/api/categories")
async def get_categories():
    """Get all unique categories."""
    db = get_db()
    pipeline = [
        {"$group": {"_id": "$category"}},
        {"$match": {"_id": {"$ne": None}}},
        {"$sort": {"_id": 1}},
    ]
    result = [doc["_id"] async for doc in db.articles.aggregate(pipeline)]
    return {"categories": result}


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

@app.get("/")
async def root():
    return {
        "message": "NewsIntel API Running 🚀"
    }