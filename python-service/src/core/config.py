"""Configuration settings for SMS AI Service."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str

    # LLM Provider settings
    # "auto" will pick the first provider with a configured API key
    llm_provider: str = "auto"  # Options: "auto", "claude", "openai", "gemini"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    google_api_key: str = ""

    # Model configurations (big/small per provider)
    claude_model: str = "claude-sonnet-4-5-20250929"
    claude_small_model: str = "claude-haiku-4-5-20251001"
    openai_model: str = "gpt-5.2-2025-12-11"
    openai_small_model: str = "gpt-5-mini-2025-08-07"
    gemini_model: str = "gemini-3-flash-preview"
    gemini_small_model: str = "gemini-3-flash-preview"

    # Analysis settings
    max_tokens: int = 8000
    temperature: float = 0.1


settings = Settings()
