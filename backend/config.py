from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    MONGODB_URI: str
    DB_NAME: str

    NEWSDATA_API_KEY: str
    GEMINI_API_KEY: str

    NEWSDATA_BASE_URL: str = "https://newsdata.io/api/1/news"
    MAX_ARTICLES_PER_RUN: int = 500

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()

print("Mongo URI:", settings.MONGODB_URI)