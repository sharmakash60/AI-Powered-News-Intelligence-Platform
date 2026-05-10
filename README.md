# NewsIntel — AI-Powered News Intelligence Platform

An end-to-end news intelligence platform that fetches real-time articles, processes them with Claude AI, and surfaces actionable insights through a polished dashboard.

![Stack](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square)
![Stack](https://img.shields.io/badge/Database-MongoDB-47A248?style=flat-square)
![Stack](https://img.shields.io/badge/AI-Claude%20Sonnet-CC785C?style=flat-square)
![Stack](https://img.shields.io/badge/Frontend-React%20+%20Vite-61DAFB?style=flat-square)

---

## Features

- **Data Pipeline** — Fetches 100–500 articles from NewsData.io with pagination, deduplication, and error handling
- **AI Summarization** — 1–2 sentence summaries per article via Claude Sonnet
- **Sentiment Analysis** — Positive / Negative / Neutral classification with numeric score
- **Key Insights** — 3–5 actionable insights extracted per article
- **Topic Tagging** — Automatic topic/tag extraction
- **Live Dashboard** — Responsive, dark-themed UI with real-time stats
- **Search & Filter** — Full-text search, sentiment filter, category filter, pagination

---

## Tech Stack

| Layer     | Technology               | Rationale |
|-----------|--------------------------|-----------|
| Backend   | FastAPI + Uvicorn        | Async Python, automatic OpenAPI docs, excellent performance |
| Database  | MongoDB + Motor          | Flexible schema for heterogeneous news data; async driver |
| AI        | Anthropic Claude Sonnet  | Best-in-class summarization and reasoning quality |
| News API  | NewsData.io              | Free tier, rich metadata, pagination support |
| Frontend  | React + Vite             | Fast HMR dev experience, component-based UI |

---

## Quick Start (under 5 minutes)

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB running locally (`mongod`) **or** a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### 1. Clone & configure

```bash
git clone https://github.com/YOUR_USERNAME/news-intelligence-platform.git
cd news-intelligence-platform
cp .env.example backend/.env
# Edit backend/.env with your API keys
```

### 2. Get API Keys (free)

| Service | URL | Time |
|---------|-----|------|
| NewsData.io | https://newsdata.io/register | 1 min |
| Anthropic | https://console.anthropic.com | 1 min |

### 3. Start backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
# → http://localhost:8000
# → API docs: http://localhost:8000/docs
```

### 4. Start frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 5. Fetch articles

Open the dashboard at `http://localhost:5173` and click **Run Pipeline**. The pipeline will:
1. Fetch articles from NewsData.io (paginated)
2. Clean and deduplicate them into MongoDB
3. Process each article with Claude AI (summary, sentiment, insights)

---

## Project Structure

```
news-intelligence-platform/
├── backend/
│   ├── main.py           # FastAPI app, all routes
│   ├── pipeline.py       # NewsData.io fetch → clean → store
│   ├── ai_processor.py   # Claude AI summarization & analysis
│   ├── database.py       # MongoDB connection & indexes
│   ├── models.py         # Pydantic data models
│   ├── config.py         # Environment settings
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Root component
│   │   ├── api.js               # API client
│   │   └── components/
│   │       ├── ArticleCard.jsx  # Article display with AI insights
│   │       ├── StatsBar.jsx     # Sentiment & count statistics
│   │       ├── SearchBar.jsx    # Search & filter controls
│   │       ├── PipelinePanel.jsx# Pipeline trigger & status
│   │       └── Pagination.jsx   # Page navigation
│   ├── index.html
│   └── vite.config.js    # Proxy /api → localhost:8000
├── .env.example
└── README.md
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/pipeline/run` | Trigger fetch + AI processing |
| `GET`  | `/api/pipeline/status` | Get pipeline run status |
| `GET`  | `/api/articles` | Get articles (search, filter, paginate) |
| `GET`  | `/api/articles/{id}` | Get single article |
| `GET`  | `/api/stats` | Dashboard statistics |
| `GET`  | `/api/categories` | All unique categories |

Full interactive docs: `http://localhost:8000/docs`

---

## MongoDB Schema

```json
{
  "article_id": "sha256 hash of URL",
  "title": "string",
  "description": "string | null",
  "content": "string | null",
  "url": "string",
  "image_url": "string | null",
  "source_name": "string",
  "category": "string",
  "published_at": "datetime",
  "ai": {
    "summary": "1-2 sentence summary",
    "sentiment": "positive | negative | neutral",
    "sentiment_score": -1.0..1.0,
    "key_insights": ["insight 1", "..."],
    "topics": ["topic1", "..."],
    "processed": true
  },
  "created_at": "datetime"
}
```

---

## Future Enhancements

- **Scheduled pipeline** — Celery + Redis to auto-fetch every 15 minutes
- **Email digest** — Daily summary of top insights per category
- **Trend detection** — Identify emerging topics across article clusters
- **User bookmarks** — Save and annotate articles
- **Multi-language** — Extend to non-English news sources
- **Deployment** — Docker Compose for one-command deployment + Railway/Render hosting
