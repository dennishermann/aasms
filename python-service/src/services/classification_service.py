"""Classification service for organizing sources according to schema."""

import asyncio
import logging
import time
from typing import Any

from src.core.llm_provider import LLMProvider
from src.core.prompts import build_per_facet_prompt

logger = logging.getLogger(__name__)


class ClassificationService:
    """Service for classifying research sources."""

    def __init__(self, llm_provider: LLMProvider):
        self.llm_provider = llm_provider

    @staticmethod
    def validate_classification_schema(schema: dict[str, Any] | list[dict[str, Any]]) -> bool:
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
            if facet_type == "open_coded":
                facet_type = "closed"
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
                        f"Expected a list of categories."
                    )
                if len(categories) == 0:
                    raise ValueError(
                        f"Closed-set facet '{name}' has an empty 'categories' array. "
                        f"Please add at least one category, or change type to 'open'."
                    )
                # Categories can be either strings or objects with id/name
                for cat in categories:
                    if not isinstance(cat, (str, dict)):
                        raise ValueError(
                            f"All categories for facet '{name}' must be strings or objects. "
                            f"Found: {type(cat).__name__}"
                        )

            elif facet_type == "open":
                # Open-set: categories can be empty (LLM will generate)
                pass

        return True

    @staticmethod
    def format_classifications(
        raw_classifications: list[dict[str, Any]],
        schema: dict[str, Any] | list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """
        Format and validate LLM classification results.
        Returns classifications with both name-based and ID-based fields for compatibility.
        """
        ClassificationService.validate_classification_schema(schema)

        # Normalize schema to dict for easier lookup, including ID mappings
        normalized_schema: dict[str, dict[str, Any]] = {}
        facet_name_to_id: dict[str, str] = {}
        category_name_to_id: dict[str, dict[str, str]] = {}  # facet_name -> {cat_name -> cat_id}

        if isinstance(schema, list):
            for facet in schema:
                name = facet.get("name") or facet.get("facet_name")
                if name:
                    normalized_schema[name] = facet
                    # Track facet ID if present
                    if facet.get("id"):
                        facet_name_to_id[name] = facet["id"]
                    # Track category IDs if present
                    categories = facet.get("categories", [])
                    cat_id_map = {}
                    for cat in categories:
                        if isinstance(cat, dict) and cat.get("id") and cat.get("name"):
                            cat_id_map[cat["name"]] = cat["id"]
                    if cat_id_map:
                        category_name_to_id[name] = cat_id_map
        else:
            normalized_schema = schema

        formatted: list[dict[str, Any]] = []
        for raw in raw_classifications:
            facet_name = raw.get("facet_name") or raw.get("facet") or raw.get("name")
            category = raw.get("category")
            keywords = raw.get("keywords")
            confidence = float(raw.get("confidence", 0.0))
            reasoning = raw.get("reasoning", "")

            if facet_name not in normalized_schema:
                logger.warning(f"Facet '{facet_name}' not found in schema, skipping")
                continue

            facet_config = normalized_schema[facet_name]
            facet_type = facet_config.get("type", "closed")
            if facet_type == "open_coded":
                facet_type = "closed"
            categories = facet_config.get("categories", [])
            required = facet_config.get("required", False)

            # Get category names for validation (handle both string and object categories)
            allowed_category_names = []
            for cat in categories:
                if isinstance(cat, str):
                    allowed_category_names.append(cat)
                elif isinstance(cat, dict) and cat.get("name"):
                    allowed_category_names.append(cat["name"])

            # Determine final category value
            final_category = category
            category_id = None

            if facet_type == "closed":
                # Validate against allowed categories for closed-set
                if category not in allowed_category_names and category != "Not Applicable":
                    # Support "Not Applicable" even if not in schema (LLM fallback)
                    if required:
                        logger.warning(
                            f"Invalid category '{category}' for required closed-set facet '{facet_name}'. "
                            f"Allowed: {allowed_category_names}. Using 'unknown'."
                        )
                        final_category = "unknown"
                    else:
                        final_category = "Not Applicable"

                # Look up category ID
                if (
                    facet_name in category_name_to_id
                    and final_category in category_name_to_id[facet_name]
                ):
                    category_id = category_name_to_id[facet_name][final_category]

            elif facet_type == "open":
                cleaned_keywords: list[str] = []
                if isinstance(keywords, list):
                    for item in keywords:
                        if isinstance(item, str) and item.strip():
                            cleaned_keywords.append(item.strip())
                elif isinstance(category, str) and category.strip():
                    cleaned_keywords.append(category.strip())

                seen = set()
                deduped: list[str] = []
                for item in cleaned_keywords:
                    key = item.lower()
                    if key in seen:
                        continue
                    seen.add(key)
                    deduped.append(item)

                final_category = None
                keywords = deduped

            # Build result with both name-based (legacy) and ID-based fields
            result = {
                "facetName": facet_name,  # camelCase for frontend
                "facet_name": facet_name,  # snake_case for backward compat
                "category": final_category,
                "confidence": confidence,
                "reasoning": reasoning,
            }

            # Add IDs if available
            if facet_name in facet_name_to_id:
                result["facetId"] = facet_name_to_id[facet_name]
            if category_id:
                result["categoryId"] = category_id

            # For open facets, include keywords list
            if facet_type == "open":
                result["keywords"] = keywords or []
                result["categoryId"] = None  # Explicitly null for open facets

            formatted.append(result)

        return formatted

    async def classify_source(
        self,
        source_content: dict[str, Any],
        classification_schema: dict[str, Any] | list[dict[str, Any]],
        research_questions: list[str] | None = None,
        previous_response_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Classify a source according to the provided schema using the configured LLM.
        Uses parallel execution with context caching for performance.
        Supports metadata-bound facets for direct/hybrid classification.
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

        # Separate facets by binding mode
        direct_facets = []  # metadataField + transform (e.g., year from date)
        hybrid_facets = []  # metadataField only (LLM maps value to category)
        llm_facets = []  # No binding, full LLM classification

        for facet in facets:
            metadata_field = facet.get("metadataField")
            metadata_transform = facet.get("metadataTransform")

            if metadata_field:
                # Check if direct extraction is possible
                if (
                    metadata_field == "publicationDate"
                    and metadata_transform in ("year", "month")
                    or metadata_field == "venueType"
                ):
                    direct_facets.append(facet)
                else:
                    # Hybrid: LLM maps metadata value to category
                    hybrid_facets.append(facet)
            else:
                llm_facets.append(facet)

        raw_results = []

        # 1. Handle direct facets (no LLM needed)
        for facet in direct_facets:
            result = self._extract_from_metadata(facet, source_content)
            if result:
                raw_results.append(result)

        # 2. Handle hybrid and LLM facets with parallel execution
        if hybrid_facets or llm_facets:
            # Context caching strategy
            context_id = previous_response_id
            reuse_context = False

            if (
                not context_id
                and hasattr(self.llm_provider, "model")
                and "gpt" in getattr(self.llm_provider, "model", "")
            ):
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

            eval_source_content = source_content
            if reuse_context:
                eval_source_content = {
                    "title": source_content.get("title"),
                    "abstract": "[Refer to context]",
                    "content_excerpt": "[Refer to context]",
                }

            # Create parallel tasks
            tasks = []

            # Hybrid facets: use metadata value in prompt
            for facet in hybrid_facets:
                metadata_field = facet.get("metadataField")
                metadata_value = source_content.get(metadata_field, "")
                prompt = self._build_hybrid_prompt(facet, metadata_value, research_questions)
                tasks.append(
                    self._classify_single_facet(
                        prompt, facet, context_id if reuse_context else None
                    )
                )

            # Regular LLM facets
            for facet in llm_facets:
                prompt = build_per_facet_prompt(
                    facet_data=facet,
                    source_content=eval_source_content,
                    research_questions=research_questions,
                )
                tasks.append(
                    self._classify_single_facet(
                        prompt, facet, context_id if reuse_context else None
                    )
                )

            if tasks:
                start_time = time.perf_counter()
                llm_results = await asyncio.gather(*tasks)
                duration = time.perf_counter() - start_time

                logger.info(
                    "classification_service.classify success",
                    extra={
                        "count": len(llm_results),
                        "duration": round(duration, 2),
                        "parallel": True,
                        "reused_context": reuse_context,
                        "direct_count": len(direct_facets),
                        "hybrid_count": len(hybrid_facets),
                    },
                )
                raw_results.extend(llm_results)

        return self.format_classifications(raw_results, classification_schema)

    def _extract_from_metadata(
        self, facet: dict[str, Any], source_content: dict[str, Any]
    ) -> dict[str, Any] | None:
        """Extract classification directly from source metadata."""
        facet_name = facet.get("name") or facet.get("facet_name")
        metadata_field = facet.get("metadataField")
        metadata_transform = facet.get("metadataTransform")

        value = source_content.get(metadata_field)
        if not value:
            return {
                "facet_name": facet_name,
                "category": "Not Applicable",
                "confidence": 1.0,
                "reasoning": f"No {metadata_field} in source metadata",
            }

        # Apply transform
        extracted_value = str(value)
        if metadata_field == "publicationDate" and metadata_transform == "year":
            # 1. Try standard date parsing
            if value:
                try:
                    if isinstance(value, str) and "-" in value:
                        extracted_value = value.split("-")[0]
                    else:
                        extracted_value = str(value)[:4]
                    if extracted_value.isdigit() and len(extracted_value) == 4:
                        return {
                            "facet_name": facet_name,
                            "category": extracted_value,
                            "confidence": 1.0,
                            "reasoning": f"Extracted from publicationDate ({value})",
                        }
                except Exception:
                    pass

            # 2. Try metadata_extension fallback (year, or database_specific.year)
            ext = source_content.get("metadata_extension") or {}

            # Direct year field
            if ext.get("year"):
                return {
                    "facet_name": facet_name,
                    "category": str(ext["year"]),
                    "confidence": 1.0,
                    "reasoning": "Extracted from metadata extension (year)",
                }

            # Database specific year
            db_spec = ext.get("database_specific") or {}
            if db_spec.get("year"):
                return {
                    "facet_name": facet_name,
                    "category": str(db_spec["year"]),
                    "confidence": 1.0,
                    "reasoning": "Extracted from metadata extension (database_specific.year)",
                }

        # Generic extraction for other fields
        extracted_value = str(value) if value else None

        if (
            metadata_field == "publicationDate"
            and metadata_transform == "month"
            and isinstance(value, str)
            and "-" in value
        ):
            parts = value.split("-")
            extracted_value = parts[1] if len(parts) > 1 else "01"

        if not extracted_value:
            return {
                "facet_name": facet_name,
                "category": "Not Applicable",
                "confidence": 1.0,
                "reasoning": f"No {metadata_field} in source metadata",
            }

        return {
            "facet_name": facet_name,
            "category": extracted_value,
            "confidence": 1.0,
            "reasoning": f"Extracted from source metadata ({metadata_field})",
        }

    def _build_hybrid_prompt(
        self, facet: dict[str, Any], metadata_value: str, research_questions: list[str]
    ) -> str:
        """Build prompt for hybrid classification (LLM maps metadata value to category)."""
        facet_name = facet.get("name") or facet.get("facet_name")
        categories = facet.get("categories", [])

        cat_names = []
        for cat in categories:
            if isinstance(cat, str):
                cat_names.append(cat)
            elif isinstance(cat, dict) and cat.get("name"):
                cat_names.append(cat["name"])

        return f"""
You are classifying a metadata value into a predefined category.

Facet: {facet_name}
Metadata Value: "{metadata_value}"

Available Categories:
{chr(10).join(f"- {c}" for c in cat_names)}

Task:
Based on the metadata value above, select the most appropriate category.

Return JSON:
{{
  "facet_name": "{facet_name}",
  "category": "selected category",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}}

Respond ONLY with JSON, no additional text.
"""

    async def _classify_single_facet(
        self, prompt: str, facet: dict[str, Any], context_id: str | None
    ) -> dict[str, Any]:
        """Classify a single facet (helper for parallel execution)."""
        facet_name = facet.get("name") or facet.get("facet_name")
        facet_type = facet.get("type", "closed")
        if facet_type == "open_coded":
            facet_type = "closed"
        try:
            response_schema = {
                "facet_name": "string",
                "confidence": "number",
                "reasoning": "string",
            }
            if facet_type == "open":
                response_schema["keywords"] = ["string"]
            else:
                response_schema["category"] = "string"

            result = await self.llm_provider.generate_structured_output(
                prompt=prompt, response_schema=response_schema, previous_response_id=context_id
            )
            if facet_type == "open":
                return {
                    "facet_name": facet_name,
                    "keywords": result.get("keywords", []),
                    "confidence": float(result.get("confidence", 0.0)),
                    "reasoning": result.get("reasoning", ""),
                }
            return {
                "facet_name": facet_name,
                "category": result.get("category", "unknown"),
                "confidence": float(result.get("confidence", 0.0)),
                "reasoning": result.get("reasoning", ""),
            }
        except Exception as e:
            logger.error(f"Failed to classify facet '{facet_name}': {e}")
            if facet_type == "open":
                return {
                    "facet_name": facet_name,
                    "keywords": [],
                    "confidence": 0.0,
                    "reasoning": f"Error: {str(e)}",
                }
            return {
                "facet_name": facet_name,
                "category": "unknown",
                "confidence": 0.0,
                "reasoning": f"Error: {str(e)}",
            }
