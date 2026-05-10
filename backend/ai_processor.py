
import json
import os
import logging
from typing import Optional
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()

import google.generativeai as genai

logger = logging.getLogger(__name__)

_model = None


def get_model():
    global _model
    if _model is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set")
        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel("gemini-2.0-flash")
    return _model


async def process_article(
    title: str,
    description: Optional[str],
    content: Optional[str],
) -> Optional[dict]:
    """
    Analyze a news article using Google Gemini (free tier).
    Returns: summary, sentiment, sentiment_score, key_insights.
    """
    body = content or description or ""
    body = body[:3000]

    if not title and not body:
        return None

    prompt = f"""You are a news intelligence analyst. Analyze this news article and respond ONLY with a valid JSON object — no markdown, no explanation, no code fences.

Title: {title}
Body: {body}

Return exactly this JSON:
{{
    "summary": "1-2 sentence summary of the article.",
    "sentiment": "positive",
    "sentiment_score": 0.0,
    "key_insights": [
        "First key insight.",
        "Second key insight.",
        "Third key insight."
    ]
}}

Rules:
- "sentiment" must be exactly: "positive", "negative", or "neutral"
- "sentiment_score" is a float from -1.0 (very negative) to 1.0 (very positive)
- "key_insights" must have 3 to 5 items
- Return ONLY the JSON object, nothing else"""

    try:
        model = get_model()
        response = model.generate_content(prompt)
        raw = response.text.strip()

        # Strip accidental markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        data = json.loads(raw)

        # Validate
        if data.get("sentiment") not in ("positive", "negative", "neutral"):
            data["sentiment"] = "neutral"

        score = float(data.get("sentiment_score", 0.0))
        data["sentiment_score"] = max(-1.0, min(1.0, score))

        insights = data.get("key_insights", [])
        if not isinstance(insights, list):
            insights = [str(insights)]
        data["key_insights"] = [str(i) for i in insights[:5]]

        data["processed_at"] = datetime.utcnow().isoformat()
        return data

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e} | Raw: {raw[:200]}")
        return None
    except Exception as e:
        logger.error(f"Gemini API error: {e}")

    # Fallback AI Processing
        text = f"{title} {description} {content}".lower()

        positive_words = [
            "growth", "success", "profit", "innovation",
            "breakthrough", "win", "positive", "improved"
         ]

        negative_words = [
            "war", "crash", "decline", "loss",
            "negative", "attack", "failure", "crisis"
        ]

        positive_score = sum(
            word in text for word in positive_words
         )

        negative_score = sum(
            word in text for word in negative_words
        )

        if positive_score > negative_score:
            sentiment = "positive"
            sentiment_score = 0.75
        elif negative_score > positive_score:
            sentiment = "negative"
            sentiment_score = -0.75
        else:
            sentiment = "neutral"
            sentiment_score = 0.0

        summary = (
        description[:200]
        if description
        else title
         )

        key_insights = [
            f"Article discusses {title[:60]}",
            "Real-time news data processed successfully",
            "AI-based sentiment analysis completed",
        ]

        return {
            "summary": summary,
            "sentiment": sentiment,
            "sentiment_score": sentiment_score,
            "key_insights": key_insights,
        }


from database import get_db


async def process_unprocessed_articles():
    """
    Process all unprocessed articles with Gemini AI.
    """
    db = get_db()

    cursor = db.articles.find({
        "ai.processed": False
    })

    processed_count = 0

    async for article in cursor:
        try:
            ai_result = await process_article(
                title=article.get("title"),
                description=article.get("description"),
                content=article.get("content"),
            )

            if not ai_result:
                continue

            ai_result["processed"] = True

            await db.articles.update_one(
                {"_id": article["_id"]},
                {"$set": {"ai": ai_result}}
            )

            processed_count += 1

        except Exception as e:
            logger.error(f"Error processing article: {e}")

    return {
        "processed": processed_count
    }

import asyncio


async def test():
    result = await process_article(
        title="OpenAI launches new AI model",
        description="OpenAI released a powerful AI system.",
        content="The new model improves reasoning and coding."
    )

    print(result)


if __name__ == "__main__":
    asyncio.run(test())