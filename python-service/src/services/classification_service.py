"""Classification service for organizing sources according to schema."""

import asyncio
import time
from typing import Dict, Any, List, Optional
import logging

from src.core.llm_provider import LLMProvider
from src.core.prompts import build_classification_prompt, build_per_facet_prompt
from src.core.schemas.classification import CLASSIFICATION_JSON_SCHEMA

logger = logging.getLogger(__name__)


class ClassificationService:
    """Service for classifying research sources."""

    def __init__(self, llm_provider: LLMProvider):
        self.llm_provider = llm_provider

    @staticmethod
    def validate_classification_schema(schema: Dict[str, Any] | List[Dict[str, Any]]) -> bool:
        """
        Validate classification schema structure.

        Args:
            schema: Classification schema to validate

        Returns:
            True if valid, raises exception otherwise

        """
        if isinstance(schema, list):
            facets = schema
        elif isinstance(schema, dict):
            facets = [
                {"name": name, **(data if isinstance(data, dict) else {})}
                for name, data in schema.items()
            ]
        else:
            raise ValueError("Classification schema must be a dictionary or list")

        for facet in facets:
            name = facet.get("name") or facet.get("facet_name") or "unnamed"
            facet_type = facet.get("type", "closed")  # Default to closed for backward compatibility
            categories = facet.get("categories", [])
            
            # Validate facet type
            if facet_type not in ["closed", "open"]:
                raise ValueError(
                    f"Facet '{name}' has invalid type: {facet_type}. "
                    f"Must be 'closed' (predefined categories) or 'open' (LLM-generated categories)."
                )

            # Validate required flag (optional, defaults to False)
            required = facet.get("required", False)
            if not isinstance(required, bool):
                 raise ValueError(
                    f"Facet '{name}' has invalid 'required' field. Must be a boolean (True/False)."
                )
            
            if facet_type == "closed":
                # Closed-set: require predefined categories
                if not categories:
                    raise ValueError(
                        f"Closed-set facet '{name}' is missing the 'categories' field. "
                        f"Closed-set facets must have at least one predefined category. "
                        f"Use type='open' if you want the LLM to generate categories freely."
                    )
                if not isinstance(categories, list):
                    raise ValueError(
                        f"Facet '{name}' has invalid 'categories' field (type: {type(categories).__name__}). "
                        f"Expected a list of category strings."
                    )
                if len(categories) == 0:
                    raise ValueError(
                        f"Closed-set facet '{name}' has an empty 'categories' array. "
                        f"Please add at least one category, or change type to 'open'."
                    )
                if not all(isinstance(c, str) for c in categories):
                    raise ValueError(
                        f"All categories for facet '{name}' must be strings. "
                        f"Found: {[type(c).__name__ for c in categories if not isinstance(c, str)]}"
                    )
            
            elif facet_type == "open":
                # Open-set: categories can be empty (LLM will generate)
                pass
        
        return True

    @staticmethod
    def format_classifications(
        raw_classifications: List[Dict[str, Any]],
        schema: Dict[str, Any] | List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Format and validate LLM classification results.
        """
        ClassificationService.validate_classification_schema(schema)

        # Normalize schema to dict for easier lookup
        normalized_schema: Dict[str, Dict[str, Any]] = {}
        if isinstance(schema, list):
            for facet in schema:
                name = facet.get("name") or facet.get("facet_name")
                if name:
                    normalized_schema[name] = facet
        else:
            normalized_schema = schema

        formatted: List[Dict[str, Any]] = []
        for raw in raw_classifications:
            facet = raw.get("facet_name") or raw.get("facet") or raw.get("name")
            category = raw.get("category")
            confidence = float(raw.get("confidence", 0.0))
            reasoning = raw.get("reasoning", "")

            if facet not in normalized_schema:
                logger.warning(f"Facet '{facet}' not found in schema, skipping")
                continue

            facet_config = normalized_schema[facet]
            facet_type = facet_config.get("type", "closed")
            allowed_categories = facet_config.get("categories", [])
            required = facet_config.get("required", False)
            
            if facet_type == "closed":
                # Validate against allowed categories for closed-set
                if category not in allowed_categories and category != "Not Applicable":
                     # Support "Not Applicable" even if not in schema (LLM fallback)
                     if required:
                         logger.warning(
                            f"Invalid category '{category}' for required closed-set facet '{facet}'. "
                            f"Allowed: {allowed_categories}. Using 'unknown'."
                        )
                         category = "unknown"
                     else:
                         category = "Not Applicable"

            elif facet_type == "open":
                # Accept any non-empty category for open-set
                if not isinstance(category, str) or not category.strip():
                    if required:
                         category = "unspecified"
                    else:
                         category = "Not Applicable"
                elif category.lower() in ["n/a", "not applicable", "none", "no category"]:
                     category = "Not Applicable"
                else:
                    category = category.strip()

            formatted.append(
                {
                    "facet_name": facet,
                    "category": category,
                    "confidence": confidence,
                    "reasoning": reasoning,
                }
            )

        return formatted

    async def classify_source(
        self,
        source_content: Dict[str, Any],
        classification_schema: Dict[str, Any] | List[Dict[str, Any]],
        research_questions: List[str] | None = None,
        previous_response_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Classify a source according to the provided schema using the configured LLM.
        Uses parallel execution with context caching for performance.
        """
        research_questions = research_questions or []
        self.validate_classification_schema(classification_schema)
        
        # Normalize schema to list
        facets = []
        if isinstance(classification_schema, list):
            facets = classification_schema
        else:
            facets = [
                {"name": name, **(data if isinstance(data, dict) else {})}
                for name, data in classification_schema.items()
            ]

        # Context caching strategy (similar to InclusionEvaluationService)
        context_id = previous_response_id
        reuse_context = False

        if not context_id and hasattr(self.llm_provider, "model") and "gpt" in getattr(self.llm_provider, "model", ""):
            try:
                 logger.info("classification_service: initializing context")
                 init_prompt = (
                     "You are a research assistant. I will provide a research source. "
                     "Please read and analyze it. I will ask you specific classification questions next.\n\n"
                     "Source Content:\n"
                     f"Title: {source_content.get('title', 'Unknown')}\n"
                     f"Abstract: {source_content.get('abstract', '')}\n"
                     f"Full Text: {source_content.get('content_excerpt', '')[:50000]}\n"
                 )
                 init_result = await self.llm_provider.generate_structured_output(
                     prompt=init_prompt,
                     response_schema={"status": "string"},
                 )
                 context_id = init_result.get("_response_id")
                 if context_id:
                     reuse_context = True
            except Exception as e:
                logger.warning(f"classification_service: context init failed: {e}")

        if context_id:
            reuse_context = True

        # Lightweight content for parallel calls
        eval_source_content = source_content
        if reuse_context:
            eval_source_content = {
                "title": source_content.get("title"),
                "abstract": "[Refer to context]",
                "content_excerpt": "[Refer to context]",
            }

        # Create parallel tasks
        tasks = []
        for facet in facets:
            prompt = build_per_facet_prompt(
                facet_data=facet,
                source_content=eval_source_content,
                research_questions=research_questions,
            )
            tasks.append(self._classify_single_facet(
                prompt, facet, context_id if reuse_context else None
            ))

        # Execute parallel
        start_time = time.perf_counter()
        raw_results = await asyncio.gather(*tasks)
        duration = time.perf_counter() - start_time
        
        logger.info(
            "classification_service.classify success",
            extra={
                "count": len(raw_results),
                "duration": round(duration, 2),
                "parallel": True,
                "reused_context": reuse_context
            },
        )

        return self.format_classifications(raw_results, classification_schema)

    async def _classify_single_facet(
        self,
        prompt: str,
        facet: Dict[str, Any],
        context_id: Optional[str]
    ) -> Dict[str, Any]:
        """Classify a single facet (helper for parallel execution)."""
        facet_name = facet.get("name") or facet.get("facet_name")
        try:
            result = await self.llm_provider.generate_structured_output(
                prompt=prompt,
                response_schema={
                    "facet_name": "string",
                    "category": "string",
                    "confidence": "number",
                    "reasoning": "string",
                },
                previous_response_id=context_id
            )
            return {
                "facet_name": facet_name,
                "category": result.get("category", "unknown"),
                "confidence": float(result.get("confidence", 0.0)),
                "reasoning": result.get("reasoning", ""),
            }
        except Exception as e:
            logger.error(f"Failed to classify facet '{facet_name}': {e}")
            return {
                "facet_name": facet_name,
                "category": "unknown",
                "confidence": 0.0,
                "reasoning": f"Error: {str(e)}",
            }

