"""
Multi-Provider Rate Limiter for LLM calls.

This module provides centralized rate limiting for OpenAI, Anthropic, and Gemini APIs.
Each provider has its own limits based on tier/plan configurations.
Uses `aiolimiter` for async-compatible token bucket rate limiting.
"""

import logging
from typing import Optional

from aiolimiter import AsyncLimiter

from src.core.config import settings

logger = logging.getLogger(__name__)


# Rate limit configurations per provider
# Format: (RPM, TPM) - verified from provider dashboards 2026-03-22
PROVIDER_RATE_LIMITS: dict[str, dict[str, tuple[int, int]]] = {
    # OpenAI: 500 RPM, 200k TPM
    "openai": {
        "default": (500, 200_000),
    },
    # Anthropic: Custom Plan — 4k RPM, 4M input TPM (Haiku), 2M (Sonnet/Opus)
    "anthropic": {
        "claude-haiku-4-5-20251001": (4_000, 4_000_000),
        "claude-sonnet-4-6": (4_000, 2_000_000),
        "default": (4_000, 2_000_000),
    },
    # Gemini: 4k RPM, 4M TPM
    "gemini": {
        "default": (4_000, 4_000_000),
    },
}


class ProviderRateLimiter:
    """Rate limiter for a single provider."""

    def __init__(self, provider: str, model_name: str):
        self.provider = provider
        self.model_name = model_name

        # Get limits for this provider
        provider_limits = PROVIDER_RATE_LIMITS.get(provider, PROVIDER_RATE_LIMITS["openai"])
        rpm, tpm = provider_limits.get(model_name, provider_limits["default"])

        logger.info(
            f"RateLimiter[{provider}]: Configured for '{model_name}' -> {rpm} RPM, {tpm} TPM"
        )

        # Create async limiters (60 second window for "per minute")
        self.request_limiter = AsyncLimiter(max_rate=rpm, time_period=60)
        self.token_limiter = AsyncLimiter(max_rate=tpm, time_period=60)
        self.rpm = rpm
        self.tpm = tpm

    async def acquire_permission(self, estimated_tokens: int = 1000):
        """
        Wait until there is capacity for 1 request and N tokens.
        """
        async with self.request_limiter:
            await self.token_limiter.acquire(min(estimated_tokens, self.tpm // 2))


class MultiProviderRateLimiter:
    """
    Manages rate limiters for multiple LLM providers.

    Each provider (OpenAI, Anthropic, Gemini) gets its own rate limiter
    with appropriate limits based on tier configuration.
    """

    _instance: Optional["MultiProviderRateLimiter"] = None

    def __init__(self):
        self._limiters: dict[str, ProviderRateLimiter] = {}

    @classmethod
    def get_instance(cls) -> "MultiProviderRateLimiter":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_limiter(self, provider: str, model_name: str | None = None) -> ProviderRateLimiter:
        """
        Get or create a rate limiter for the specified provider.

        Args:
            provider: One of "openai", "anthropic", "gemini"
            model_name: Specific model name (optional, uses config default if not provided)

        Returns:
            ProviderRateLimiter instance for this provider
        """
        # Determine model name from config if not provided
        if model_name is None:
            if provider == "openai":
                model_name = settings.openai_small_model
            elif provider == "anthropic":
                model_name = settings.claude_small_model
            elif provider == "gemini":
                model_name = settings.gemini_small_model
            else:
                model_name = "default"

        # Cache key includes both provider and model
        cache_key = f"{provider}:{model_name}"

        if cache_key not in self._limiters:
            self._limiters[cache_key] = ProviderRateLimiter(provider, model_name)

        return self._limiters[cache_key]


# Convenience functions for backward compatibility and ease of use


def get_rate_limiter(
    provider: str = "openai", model_name: str | None = None
) -> ProviderRateLimiter:
    """
    Get a rate limiter for the specified provider.

    Args:
        provider: One of "openai", "anthropic", "gemini"
        model_name: Specific model name (optional)

    Returns:
        ProviderRateLimiter instance
    """
    return MultiProviderRateLimiter.get_instance().get_limiter(provider, model_name)


def get_openai_limiter(model_name: str | None = None) -> ProviderRateLimiter:
    """Get rate limiter for OpenAI."""
    return get_rate_limiter("openai", model_name)


def get_anthropic_limiter(model_name: str | None = None) -> ProviderRateLimiter:
    """Get rate limiter for Anthropic (Claude)."""
    return get_rate_limiter("anthropic", model_name)


def get_gemini_limiter(model_name: str | None = None) -> ProviderRateLimiter:
    """Get rate limiter for Google Gemini."""
    return get_rate_limiter("gemini", model_name)
