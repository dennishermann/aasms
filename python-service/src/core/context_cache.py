"""Shared OpenAI context caching logic for LLM services."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def is_openai_provider(llm_provider: Any) -> bool:
    """Check if the provider is an OpenAI provider that supports context caching."""
    return hasattr(llm_provider, "model") and "gpt" in getattr(
        llm_provider, "model", ""
    )


async def initialize_context(
    llm_provider: Any,
    source_content: dict[str, Any],
    previous_response_id: str | None = None,
    purpose: str = "questions",
) -> tuple[str | None, dict[str, Any]]:
    """Initialize OpenAI context caching if applicable.

    Returns (context_id, eval_source_content) where eval_source_content is either
    the original source_content or a reduced version referencing the cached context.
    """
    context_id = previous_response_id
    reuse_context = False

    if not context_id and is_openai_provider(llm_provider):
        try:
            logger.info("context_cache: initializing context with OpenAI Responses API")
            init_prompt = (
                "You are a research assistant. I will provide a research source. "
                f"Please read and analyze it. I will ask you specific {purpose} next.\n\n"
                "Source Content:\n"
                f"Title: {source_content.get('title', 'Unknown')}\n"
                f"Abstract: {source_content.get('abstract', '')}\n"
                f"Full Text: {source_content.get('content_excerpt', '')[:50000]}\n"
            )
            init_result = await llm_provider.generate_structured_output(
                prompt=init_prompt,
                response_schema={"status": "string"},
            )
            context_id = init_result.get("_response_id")
            if context_id:
                logger.info(f"context_cache: context initialized, id={context_id}")
                reuse_context = True
        except Exception as e:
            logger.warning(f"context_cache: context init failed: {e}")

    if context_id:
        reuse_context = True

    if reuse_context:
        eval_source_content = {
            "title": source_content.get("title"),
            "abstract": "[Refer to context]",
            "content_excerpt": "[Refer to context]",
        }
        # Preserve extra fields from original content (e.g. venue, publication_date)
        for key in ("venue", "publication_date"):
            if key in source_content:
                eval_source_content[key] = source_content.get(key)
        return context_id, eval_source_content

    return context_id, source_content


def normalize_criteria(criteria: list[Any]) -> list[str]:
    """Normalize criteria from mixed dict/string format to plain strings."""
    return [
        c["criterion"] if isinstance(c, dict) and "criterion" in c else str(c)
        for c in criteria
    ]
