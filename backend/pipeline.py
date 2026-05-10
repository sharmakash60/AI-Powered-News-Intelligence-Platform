import httpx
import hashlib
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from database import get_db
from config import settings

logger = logging.getLogger(__name__)


def generate_article_id(url: str) -> str:
    """Generate a stable unique ID from article URL."""
    return hashlib.sha256(url.encode()).hexdigest()[:24]


def clean_text(text: Optional[str]) -> Optional[str]:
    """Strip excessive whitespace and null-like strings."""
    if not text or text.strip().lower() in ("none", "null", "n/a", ""):
        return None
    return " ".join(text.split())


def parse_published_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse NewsData.io date format."""
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


def validate_article(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Validate and clean a raw article from the API."""
    url = raw.get("link") or raw.get("url")
    title = clean_text(raw.get("title"))

    if not url or not title:
        return None  # Skip articles without URL or title

    description = clean_text(raw.get("description"))
    content = clean_text(raw.get("content") or raw.get("full_description"))

    return {
        "article_id": generate_article_id(url),
        "title": title,
        "description": description,
        "content": content,
        "url": url,
        "image_url": raw.get("image_url"),
        "source_name": raw.get("source_id") or raw.get("source_name"),
        "category": raw.get("category", ["general"])[0] if isinstance(raw.get("category"), list) else raw.get("category", "general"),
        "language": raw.get("language"),
        "country": raw.get("country") if isinstance(raw.get("country"), list) else [raw.get("country")] if raw.get("country") else [],
        "published_at": parse_published_date(raw.get("pubDate") or raw.get("publishedAt")),
        "ai": {
            "summary": "",
            "sentiment": "neutral",
            "sentiment_score": 0.0,
            "key_insights": [],
            "topics": [],
            "processed": False,
        },
        "created_at": datetime.utcnow(),
    }


async def fetch_page(client: httpx.AsyncClient, page_token: Optional[str] = None) -> Dict[str, Any]:
    """Fetch a single page of news articles."""
    params = {
        "apikey": settings.NEWSDATA_API_KEY,
        "language": "en",
        "size": 50,  # NewsData.io free tier max per page
    }
    if page_token:
        params["page"] = page_token

    resp = await client.get(settings.NEWSDATA_BASE_URL, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


async def run_pipeline() -> Dict[str, int]:
    """
    Full pipeline: fetch → clean → deduplicate → store.
    Returns counts of fetched, new, and errored articles.
    """
    db = get_db()
    stats = {"fetched": 0, "new": 0, "skipped": 0, "errors": 0}

    if not settings.NEWSDATA_API_KEY:
        raise ValueError("NEWSDATA_API_KEY is not configured")

    page_token = None
    pages_fetched = 0
    max_pages = max(1, settings.MAX_ARTICLES_PER_RUN // 50)

    async with httpx.AsyncClient() as client:
        while pages_fetched < max_pages:
            try:
                data = await fetch_page(client, page_token)
            except httpx.HTTPStatusError as e:
                logger.error(f"HTTP error fetching news: {e}")
                stats["errors"] += 1
                break
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                stats["errors"] += 1
                break

            if data.get("status") != "success":
                logger.warning(f"API returned non-success status: {data.get('message')}")
                break

            results = data.get("results") or []
            if not results:
                break

            stats["fetched"] += len(results)
            pages_fetched += 1

            # Clean and validate
            cleaned = [validate_article(r) for r in results]
            valid_articles = [a for a in cleaned if a is not None]

            # Bulk upsert — insert only new articles (skip duplicates)
            for article in valid_articles:
                try:
                    result = await db.articles.update_one(
                        {"article_id": article["article_id"]},
                        {"$setOnInsert": article},
                        upsert=True,
                    )
                    if result.upserted_id:
                        stats["new"] += 1
                    else:
                        stats["skipped"] += 1
                except Exception as e:
                    logger.error(f"DB insert error: {e}")
                    stats["errors"] += 1

            # Pagination
            next_page = data.get("nextPage")
            if not next_page:
                break
            page_token = next_page

    logger.info(f"Pipeline complete: {stats}")
    return stats