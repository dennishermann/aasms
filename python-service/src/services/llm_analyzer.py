"""LLM-based analysis service for source evaluation and classification."""

import logging
import uuid
from typing import Any

from src.core.llm_provider import LLMProvider
from src.services.classification_service import ClassificationService
from src.services.inclusion_evaluation_service import InclusionEvaluationService

# Ensure this module logs at INFO with a handler (uvicorn defaults to WARNING)
logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False


class LLMAnalyzer:
    """
    Orchestrator service for analyzing research sources using LLM.

    This service coordinates between InclusionEvaluationService and ClassificationService
    to provide a complete analysis workflow.
    """

    def __init__(self, llm_provider: LLMProvider):
        self.llm_provider = llm_provider
        self.inclusion_service = InclusionEvaluationService(llm_provider)
        self.classification_service = ClassificationService(llm_provider)

    async def analyze_source(
        self,
        source_content: dict[str, Any],
        study_parameters: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Analyze a source against study criteria and classify it.

        This orchestrates the full analysis workflow:
        1. Evaluate inclusion/exclusion criteria
        2. If included and schema exists, classify the source
        """
        inclusion_results = await self.inclusion_service.evaluate_inclusion(
            source_content=source_content,
            inclusion_criteria=study_parameters.get("inclusion_criteria", []),
            exclusion_criteria=study_parameters.get("exclusion_criteria", []),
            research_questions=study_parameters.get("research_questions", []),
        )

        recommendation = inclusion_results["recommendation"]
        overall_confidence = inclusion_results.get("overall_confidence", 0.5)
        classification_results: list[dict[str, Any]] = []

        classification_schema = study_parameters.get("classification_schema", {})
        has_schema = bool(classification_schema)

        # Only classify when the source is recommended for inclusion and a schema exists.
        if recommendation and has_schema:
            classification_results = await self.classification_service.classify_source(
                source_content=source_content,
                classification_schema=classification_schema,
                research_questions=study_parameters.get("research_questions", []),
            )
        else:
            logger.info(
                "classify: skipped",
                extra={
                    "reason": "not_included" if not recommendation else "no_schema",
                    "recommendation": recommendation,
                    "has_schema": has_schema,
                },
            )

        return {
            "analysis_id": str(uuid.uuid4()),
            "recommendation": "include" if recommendation else "exclude",
            "inclusion_reasoning": inclusion_results.get("inclusion_reasoning", ""),
            "exclusion_reasoning": inclusion_results.get("exclusion_reasoning", ""),
            "confidence": overall_confidence,
            "inclusion_criteria": inclusion_results.get("inclusion_criteria", []),
            "exclusion_criteria": inclusion_results.get("exclusion_criteria", []),
            "classifications": classification_results,
            "relevance_score": inclusion_results.get("relevance_score"),
        }
