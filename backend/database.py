from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, TEXT
from config import settings
import logging

logger = logging.getLogger(__name__)

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.DB_NAME]
    await create_indexes()
    logger.info("Connected to MongoDB")


async def close_db():
    global client
    if client:
        client.close()
        logger.info("Disconnected from MongoDB")


async def create_indexes():
    # Unique index on article_id to prevent duplicates
    await db.articles.create_index("article_id", unique=True)
    # Text index for search
    await db.articles.create_index([("title", TEXT), ("description", TEXT)])
    # Index for filtering by sentiment and category
    await db.articles.create_index("sentiment")
    await db.articles.create_index("category")
    await db.articles.create_index([("published_at", DESCENDING)])


def get_db():
    return db
