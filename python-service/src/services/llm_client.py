"""Centralized LLM client utilities for Anthropic/OpenAI (text + metadata extraction)."""

from __future__ import annotations

import base64
import json
import logging
from typing import Any, Dict, Optional

from src.core.config import settings
from src.core.schemas.metadata import METADATA_JSON_SCHEMA, METADATA_RESPONSE_FORMAT
from src.core.rate_limiter import get_rate_limiter

from tenacity import (
    retry,
    stop_after_attempt,
    wait_random_exponential,
    retry_if_exception_type,
)

logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    # Add file handler for debugging
    file_handler = logging.FileHandler("debug_llm.log")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
logger.setLevel(logging.INFO)
logger.propagate = False

_anthropic_client = None
_openai_client = None


def _get_anthropic_client():
    """Return cached Anthropic client."""
    global _anthropic_client
    if _anthropic_client:
        return _anthropic_client
    try:
        from anthropic import AsyncAnthropic
    except ImportError:
        raise RuntimeError("anthropic package not installed")
    _anthropic_client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _anthropic_client


def _get_openai_client():
    """Return cached OpenAI client."""
    global _openai_client
    if _openai_client:
        return _openai_client
    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise RuntimeError("openai package not installed")
    _openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _openai_client


def strip_json_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


def _to_json_schema(response_schema: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Convert a lightweight shape description (e.g., {"foo": "string"}) to a JSON Schema
    understood by the OpenAI Responses API. If the caller already provides a JSON Schema
    (has a top-level ``type``), it is returned as-is.
    """
    if not response_schema:
        return {"type": "object", "additionalProperties": True}

    # Already a JSON schema
    if isinstance(response_schema, dict) and "type" in response_schema:
        return response_schema

    type_map = {
        "string": "string",
        "number": "number",
        "boolean": "boolean",
        "object": "object",
        "array": "array",
    }

    def convert(val: Any) -> Dict[str, Any]:
        # Allow nested shorthand definitions like {"items": {"foo": "string"}}
        if isinstance(val, dict) and "type" in val:
            return val
        if isinstance(val, dict):
            props = {k: convert(v) for k, v in val.items()}
            return {
                "type": "object",
                "properties": props,
                "required": list(props.keys()),
                "additionalProperties": False,
            }
        if isinstance(val, list) and val:
            # Treat first element as item schema
            item_schema = convert(val[0])
            return {"type": "array", "items": item_schema}
        mapped = type_map.get(str(val).lower(), "string")
        return {"type": mapped}

    properties: Dict[str, Any] = {}
    for key, val in response_schema.items():
        properties[key] = convert(val)

    return {
        "type": "object",
        "properties": properties,
        "required": list(properties.keys()),
        "additionalProperties": False,
    }


async def generate_json(
    provider_name: str,
    model_name: str,
    prompt: str,
    temperature: float = 0.1,
    max_tokens: int = 800,
    response_schema: Optional[Dict[str, Any]] = None,
    previous_response_id: Optional[str] = None,
) -> Dict[str, Any]:
    retry_args = {
        "wait": wait_random_exponential(min=1, max=60),
        "stop": stop_after_attempt(6),
    }

    if provider_name == "claude":
        return await _generate_json_claude_with_retry(model_name, prompt, temperature, max_tokens)

    if provider_name == "openai":
        return await _generate_json_openai_with_retry(
            model_name,
            prompt,
            temperature,
            max_tokens,
            response_schema,
            previous_response_id,
        )

    raise RuntimeError(f"Unsupported provider: {provider_name}")


@retry(
    wait=wait_random_exponential(min=1, max=60),
    stop=stop_after_attempt(6),
    retry=retry_if_exception_type((Exception)), # We will refine to RateLimitError inside
)
async def _generate_json_claude_with_retry(
    model_name: str,
    prompt: str,
    temperature: float,
    max_tokens: int,
) -> Dict[str, Any]:
    # 1. Proactive Rate Limiting
    # Estimate tokens: prompt + max_tokens (conservative)
    estimated = (len(prompt) // 4) + max_tokens
    await get_rate_limiter().acquire_permission(estimated)
    
    return await _generate_json_claude(model_name, prompt, temperature, max_tokens)


@retry(
    wait=wait_random_exponential(min=1, max=60),
    stop=stop_after_attempt(6),
    # In production code, you should import specific RateLimitErrors from SDKs
    # e.g. openai.RateLimitError, anthropic.RateLimitError
    retry=retry_if_exception_type((Exception)), 
)
async def _generate_json_openai_with_retry(
    model_name: str,
    prompt: str,
    temperature: float,
    max_tokens: int,
    response_schema: Optional[Dict[str, Any]],
    previous_response_id: Optional[str] = None,
) -> Dict[str, Any]:
    # 1. Proactive Rate Limiting
    estimated = (len(prompt) // 4) + max_tokens
    await get_rate_limiter().acquire_permission(estimated)

    return await _generate_json_openai(
        model_name,
        prompt,
        temperature,
        max_tokens,
        response_schema,
        previous_response_id,
    )


async def _generate_json_claude(
    model_name: str,
    prompt: str,
    temperature: float,
    max_tokens: int,
) -> Dict[str, Any]:
    client = _get_anthropic_client()
    msg = await client.messages.create(
        model=model_name,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
        temperature=temperature,
    )
    content = msg.content[0].text if msg.content else "{}"
    logger.info(f"raw_llm_response_preview: {content[:500]}...")
    try:
        return json.loads(strip_json_fences(content))
    except Exception:
        logger.warning("generate_json claude parse failed; returning {}")
        return {}


async def _generate_json_openai(
    model_name: str,
    prompt: str,
    temperature: float,
    max_tokens: int,
    response_schema: Optional[Dict[str, Any]],
    previous_response_id: Optional[str] = None,
) -> Dict[str, Any]:
    client = _get_openai_client()
    json_schema = _to_json_schema(response_schema)
    kwargs = {
        "model": model_name,
        "input": [{"role": "user", "content": [{"type": "input_text", "text": prompt}]}],
        "max_output_tokens": max_tokens,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "structured_output",
                "schema": json_schema,
                "strict": True,
            }
        },
    }

    if previous_response_id:
        # Use existing conversation context
        kwargs["input"] = [{"role": "user", "content": [{"type": "input_text", "text": prompt}]}]
        kwargs["previous_response_id"] = previous_response_id
    else:
        # Start new conversation
        kwargs["input"] = [{"role": "user", "content": [{"type": "input_text", "text": prompt}]}]

    
    # O1 and GPT-5 models often reject custom temperature
    if not (model_name.startswith("o1-") or model_name.startswith("gpt-5")):
        kwargs["temperature"] = temperature

    resp = await client.responses.create(**kwargs)
    
    if getattr(resp, "error", None):
        logger.error(f"OpenAI Response API returned error: {resp.error}")
        return {}

    text = getattr(resp, "output_text", "") or ""
    
    if not text:
        logger.error("OpenAI Response API returned EMPTY output_text.")
        logger.error(f"Response dump: {resp}")
        # Try to find refusal or status
        logger.error(f"Status: {getattr(resp, 'status', 'unknown')}")
        logger.error(f"Refusal: {getattr(resp, 'refusal', 'unknown')}")
        logger.error(f"Usage: {getattr(resp, 'usage', 'unknown')}")

    try:
        data = json.loads(strip_json_fences(text) or "{}")
        # Inject response_id for potential reuse
        if hasattr(resp, "id"):
            data["_response_id"] = resp.id
        return data
    except Exception as e:
        logger.warning(f"generate_json openai parse failed: {e}; returning {{}}")
        logger.warning(f"Response text was: {text}")
        return {}



