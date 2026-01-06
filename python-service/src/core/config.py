"""Configuration settings for SMS AI Service."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str

    # LLM Provider settings
    # "auto" will pick the first provider with a configured API key
    llm_provider: str = "auto"  # Options: "auto", "claude", "openai"
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # Model configurations (big/small per provider)
    # Model configurations (big/small per provider)
    claude_model: str
    claude_small_model: str
    openai_model: str
    openai_small_model: str

    # Analysis settings
    max_tokens: int = 8000
    temperature: float = 0.1


settings = Settings()
