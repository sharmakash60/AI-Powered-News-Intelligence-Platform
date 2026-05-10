from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ArticleBase(BaseModel):
    article_id: str
    title: str
    description: Optional[str] = None
    content: Optional[str] = None
    url: str
    image_url: Optional[str] = None
    source_name: Optional[str] = None
    category: Optional[str] = None
    language: Optional[str] = None
    country: Optional[List[str]] = None
    published_at: Optional[datetime] = None


class ArticleCreate(ArticleBase):
    pass


class AIInsights(BaseModel):
    summary: str = ""
    sentiment: str = "neutral"          # positive | negative | neutral
    sentiment_score: float = 0.0        # -1.0 to 1.0
    key_insights: List[str] = []
    topics: List[str] = []
    processed: bool = False


class Article(ArticleBase):
    id: Optional[str] = Field(default=None, alias="_id")
    ai: AIInsights = AIInsights()
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class ArticleResponse(BaseModel):
    id: str
    article_id: str
    title: str
    description: Optional[str] = None
    url: str
    image_url: Optional[str] = None
    source_name: Optional[str] = None
    category: Optional[str] = None
    published_at: Optional[datetime] = None
    ai: AIInsights
    created_at: datetime


class PaginatedArticles(BaseModel):
    articles: List[ArticleResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class DashboardStats(BaseModel):
    total_articles: int
    positive_count: int
    negative_count: int
    neutral_count: int
    categories: dict
    sources: dict
    processed_count: int
    last_fetched: Optional[datetime] = None


class PipelineStatus(BaseModel):
    status: str
    message: str
    fetched: int = 0
    new_articles: int = 0
    ai_processed: int = 0
    errors: int = 0
