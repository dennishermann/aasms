"""
 Global Rate Limiter for LLM calls.

 This module provides a centralized rate limiter to ensure we respect OpenAI's
 strict limits (especially for models like gpt-5-mini). It uses `aiolimiter`
 to implement a token bucket algorithm for Request limits (RPM) and Token limits (TPM).
 """

import logging
from aiolimiter import AsyncLimiter
from src.core.config import settings

logger = logging.getLogger(__name__)

# Configuration for different models
# Format: (RPM, TPM)
RATE_LIMITS = {
    # Default fallback
    "default": (500, 30_000),
    
    # Official gpt-5-mini limits: 500 RPM, 500,000 TPM
    "gpt-5-mini": (500, 500_000),
    
    # Other common models
    "gpt-4o": (500, 30_000),
    "gpt-4o-mini": (500, 200_000),
}

class GlobalRateLimiter:
    """
    Singleton-style rate limiter that manages both Request capacity and Token capacity.
    """
    _instance = None
    
    def __init__(self, model_name: str = "gpt-5-mini"):
        # Determine limits based on model
        rpm, tpm = RATE_LIMITS.get(model_name, RATE_LIMITS["default"])
        
        # Override if config specifies different model
        # We try to match the config model to our known table
        conf_model = settings.openai_small_model if "mini" in model_name else settings.openai_model
        
        # 1. Exact match
        if conf_model in RATE_LIMITS:
             rpm, tpm = RATE_LIMITS[conf_model]
             logger.info(f"RateLimiter: Exact match for '{conf_model}' -> {rpm} RPM, {tpm} TPM")
        # 2. Smart partial match
        elif "mini" in conf_model.lower():
             # Assume high limits for any mini model
             rpm, tpm = RATE_LIMITS["gpt-5-mini"]
             logger.warning(f"RateLimiter: Partial match for '{conf_model}' -> Using gpt-5-mini limits ({rpm}, {tpm})")
        # 3. Fallback
        else:
             logger.warning(f"RateLimiter: No match for '{conf_model}' -> Using DEFAULT limits ({rpm}, {tpm}). THIS MAY BE SLOW.")

        print(f"DEBUG: RateLimiter initialized for model '{conf_model}' with {rpm} RPM and {tpm} TPM")

        # Create limiters
        # window is usually 60 seconds for "Per Minute"
        self.request_limiter = AsyncLimiter(max_rate=rpm, time_period=60)
        self.token_limiter = AsyncLimiter(max_rate=tpm, time_period=60)
        
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            # We assume we are optimizing for the 'small' model which is used for bulk operations
            cls._instance = cls(model_name=settings.openai_small_model)
        return cls._instance

    async def acquire_permission(self, estimated_tokens: int = 1000):
        """
        Wait until there is capacity for 1 request and N tokens.
        """
        # print(f"DEBUG: RateLimiter acquiring: 1 req, {estimated_tokens} tokens")
        async with self.request_limiter:
            # We acquired 1 request slot
            # Now wait for token slot
            await self.token_limiter.acquire(estimated_tokens)
        # print(f"DEBUG: RateLimiter acquired!")

# Global instance accessor
def get_rate_limiter():
    return GlobalRateLimiter.get_instance()
