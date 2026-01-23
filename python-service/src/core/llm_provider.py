"""LLM Provider abstraction layer supporting Claude and OpenAI."""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Tuple, List

from .config import settings
from src.services.llm_client import generate_json


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def generate_structured_output(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        response_schema: Optional[Dict[str, Any]] = None,
        max_tokens: int = 4000,
        previous_response_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a structured JSON output from the LLM."""
        pass


class ClaudeProvider(LLMProvider):
    """Anthropic Claude LLM provider."""

    def __init__(self, model: str = "claude-3-5-sonnet-20241022"):
        self.model = model

    async def generate_structured_output(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        response_schema: Optional[Dict[str, Any]] = None,
        max_tokens: int = 4000,
        previous_response_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate structured JSON output using Claude."""
        return await generate_json(
            "claude",
            self.model,
            prompt,
            temperature=0.1,
            max_tokens=max_tokens,
            response_schema=response_schema,
            # Claude doesn't support previous_response_id in this client yet
        )


class OpenAIProvider(LLMProvider):
    """OpenAI GPT LLM provider."""

    def __init__(self, model: str = "gpt-4o"):
        self.model = model

    async def generate_structured_output(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        response_schema: Optional[Dict[str, Any]] = None,
        max_tokens: int = 4000,
        previous_response_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate structured JSON output using OpenAI."""
        return await generate_json(
            "openai",
            self.model,
            prompt,
            temperature=0.1,
            max_tokens=max_tokens,
            response_schema=response_schema,
            previous_response_id=previous_response_id,
        )


class GeminiProvider(LLMProvider):
    """Google Gemini LLM provider."""

    def __init__(self, model: str = "gemini-3-flash-preview"):
        self.model = model

    async def generate_structured_output(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        response_schema: Optional[Dict[str, Any]] = None,
        max_tokens: int = 4000,
        previous_response_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate structured JSON output using Google Gemini."""
        return await generate_json(
            "gemini",
            self.model,
            prompt,
            temperature=0.1,
            max_tokens=max_tokens,
            response_schema=response_schema,
            # Gemini doesn't support previous_response_id
        )


def available_providers() -> List[str]:
    """Return a list of providers that have credentials configured."""
    providers = []
    if settings.anthropic_api_key:
        providers.append("claude")
    if settings.openai_api_key:
        providers.append("openai")
    if settings.google_api_key:
        providers.append("gemini")
    return providers


def resolve_provider_name(prefer_small_model: bool = False) -> Tuple[str, str]:
    """
    Resolve the provider name and model to use.

    Returns:
        (provider_name, model_name)
    """
    provider_name = settings.llm_provider.lower()
    small = prefer_small_model

    # Auto-pick based on available keys
    if provider_name == "auto":
        if settings.anthropic_api_key:
            return "claude", (
                settings.claude_small_model if small else settings.claude_model
            )
        if settings.openai_api_key:
            return "openai", (
                settings.openai_small_model if small else settings.openai_model
            )
        if settings.google_api_key:
            return "gemini", (
                settings.gemini_small_model if small else settings.gemini_model
            )
        raise ValueError("No LLM provider credentials configured for auto mode")

    if provider_name == "claude":
        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY not configured")
        return "claude", settings.claude_small_model if small else settings.claude_model

    if provider_name == "openai":
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY not configured")
        return "openai", settings.openai_small_model if small else settings.openai_model

    if provider_name == "gemini":
        if not settings.google_api_key:
            raise ValueError("GOOGLE_API_KEY not configured")
        return "gemini", settings.gemini_small_model if small else settings.gemini_model

    raise ValueError(f"Unknown LLM provider: {provider_name}")


def get_llm_provider(prefer_small_model: bool = False) -> LLMProvider:
    """Factory function to get the configured LLM provider instance."""
    provider_name, model_name = resolve_provider_name(prefer_small_model)

    if provider_name == "claude":
        return ClaudeProvider(model_name)

    if provider_name == "openai":
        return OpenAIProvider(model_name)

    if provider_name == "gemini":
        return GeminiProvider(model_name)

    raise ValueError(f"Unknown LLM provider: {provider_name}")


def get_voting_providers(prefer_small_model: bool = True) -> List[LLMProvider]:
    """
    Get list of providers for multi-LLM voting.
    Returns all configured providers (OpenAI, Claude, Gemini).
    For voting to work properly, at least 2 providers must be configured.
    """
    providers = []

    if settings.openai_api_key:
        model = settings.openai_small_model if prefer_small_model else settings.openai_model
        providers.append(OpenAIProvider(model))

    if settings.anthropic_api_key:
        model = settings.claude_small_model if prefer_small_model else settings.claude_model
        providers.append(ClaudeProvider(model))

    if settings.google_api_key:
        model = settings.gemini_small_model if prefer_small_model else settings.gemini_model
        providers.append(GeminiProvider(model))

    if len(providers) < 2:
        raise ValueError(
            f"Multi-LLM voting requires at least 2 providers. "
            f"Found {len(providers)}. Configure additional API keys."
        )

    return providers


def voting_available() -> bool:
    """Check if multi-LLM voting is available (at least 2 providers configured)."""
    count = 0
    if settings.openai_api_key:
        count += 1
    if settings.anthropic_api_key:
        count += 1
    if settings.google_api_key:
        count += 1
    return count >= 2

