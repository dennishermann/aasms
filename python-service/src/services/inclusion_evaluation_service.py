"""Inclusion/Exclusion evaluation service for systematic mapping studies."""

from typing import Dict, Any, List
import statistics
import logging
import time
import asyncio

from src.core.llm_provider import LLMProvider
from src.core.prompts import build_per_criterion_prompt

logger = logging.getLogger(__name__)


class InclusionEvaluationService:
    """Service for evaluating sources against inclusion/exclusion criteria."""

    def __init__(self, llm_provider: LLMProvider):
        self.llm_provider = llm_provider

    @staticmethod
    def validate_criteria(
        inclusion_criteria: List[Any],
        exclusion_criteria: List[Any]
    ) -> bool:
        """
        Validate inclusion and exclusion criteria structure.

        Args:
            inclusion_criteria: List of inclusion criteria
            exclusion_criteria: List of exclusion criteria

        Returns:
            True if valid, raises exception otherwise
        """
        if not isinstance(inclusion_criteria, list):
            raise ValueError("Inclusion criteria must be a list")
        
        if not isinstance(exclusion_criteria, list):
            raise ValueError("Exclusion criteria must be a list")
        
        # Validate that criteria are non-empty strings or dicts with "criterion" field
        for i, criterion in enumerate(inclusion_criteria):
            if isinstance(criterion, dict):
                if "criterion" not in criterion:
                    raise ValueError(
                        f"Inclusion criterion at index {i} is a dict but missing 'criterion' field"
                    )
                if not isinstance(criterion["criterion"], str) or not criterion["criterion"].strip():
                    raise ValueError(
                        f"Inclusion criterion at index {i} has empty or invalid criterion text"
                    )
            elif isinstance(criterion, str):
                if not criterion.strip():
                    raise ValueError(f"Inclusion criterion at index {i} is an empty string")
            else:
                raise ValueError(
                    f"Inclusion criterion at index {i} must be a string or dict with 'criterion' field"
                )
        
        for i, criterion in enumerate(exclusion_criteria):
            if isinstance(criterion, dict):
                if "criterion" not in criterion:
                    raise ValueError(
                        f"Exclusion criterion at index {i} is a dict but missing 'criterion' field"
                    )
                if not isinstance(criterion["criterion"], str) or not criterion["criterion"].strip():
                    raise ValueError(
                        f"Exclusion criterion at index {i} has empty or invalid criterion text"
                    )
            elif isinstance(criterion, str):
                if not criterion.strip():
                    raise ValueError(f"Exclusion criterion at index {i} is an empty string")
            else:
                raise ValueError(
                    f"Exclusion criterion at index {i} must be a string or dict with 'criterion' field"
                )
        
        return True

    async def evaluate_inclusion(
        self,
        source_content: Dict[str, Any],
        inclusion_criteria: List[Any],
        exclusion_criteria: List[Any],

        research_questions: List[str] | None = None,
        previous_response_id: str | None = None,
    ) -> Dict[str, Any]:
        """
        Evaluate source against inclusion/exclusion criteria.

        Each criterion is evaluated individually by the LLM.
        The final recommendation is deterministic: ALL inclusion criteria must be fulfilled
        AND NO exclusion criteria can be fulfilled.

        Args:
            source_content: Dictionary containing source text and metadata
            inclusion_criteria: List of inclusion criteria
            exclusion_criteria: List of exclusion criteria
            research_questions: List of research questions for context

        Returns:
            Dictionary containing recommendation, reasoning, and per-criterion results
        """
        research_questions = research_questions or []
        
        # Normalize criteria to strings
        inclusion_list = [
            c["criterion"] if isinstance(c, dict) and "criterion" in c else str(c)
            for c in inclusion_criteria
        ]
        exclusion_list = [
            c["criterion"] if isinstance(c, dict) and "criterion" in c else str(c)
            for c in exclusion_criteria
        ]
        
        start_time = time.perf_counter()

        logger.info(
            "inclusion_evaluation: starting evaluation",
            extra={
                "inclusion_criteria_count": len(inclusion_list),
                "exclusion_criteria_count": len(exclusion_list),
                "research_questions_count": len(research_questions),
                "title": (source_content.get("title") or "")[:120],
                "abstract_length": len(source_content.get("abstract") or ""),
                "has_content_excerpt": bool(source_content.get("content_excerpt")),
                "content_excerpt_length": len(source_content.get("content_excerpt") or ""),
            },
        )



        # Context Management Strategy
        # If we have a previous_response_id (or get one from init), we reuse it.
        context_id = previous_response_id
        reuse_context = False

        if not context_id and hasattr(self.llm_provider, "model") and "gpt" in getattr(self.llm_provider, "model", ""):


            try:
                 # Initialize context with full source content
                 # We use a dummy schema just to get the mechanism to work and return an ID
                 logger.info("inclusion_evaluation: initializing context with OpenAI Responses API")
                 init_prompt = (
                     "You are a research assistant. I will provide a research source. "
                     "Please read and analyze it. I will ask you specific questions about it next.\n\n"
                     "Source Content:\n"
                     f"Title: {source_content.get('title', 'Unknown')}\n"
                     f"Abstract: {source_content.get('abstract', '')}\n"
                     f"Full Text: {source_content.get('content_excerpt', '')[:50000]}\n" # Cap at 50k chars for safety
                 )
                 init_result = await self.llm_provider.generate_structured_output(
                     prompt=init_prompt,
                     response_schema={"status": "string"},
                 )
                 context_id = init_result.get("_response_id")
                 if context_id:
                     logger.info(f"inclusion_evaluation: context initialized, id={context_id}")
                     reuse_context = True
            except Exception as e:
                logger.warning(f"inclusion_evaluation: context init failed: {e}")

        if context_id:
            reuse_context = True

        # If reusing context, we use a lightweight source content for individual criteria
        # to avoid re-sending tokens.
        eval_source_content = source_content
        if reuse_context:
            eval_source_content = {
                "title": source_content.get("title"),
                "abstract": "[Refer to context]",
                "content_excerpt": "[Refer to context]",
                "venue": source_content.get("venue"),
                "publication_date": source_content.get("publication_date"),
            }

        inclusion_results = []
        exclusion_results = []

        # Create tasks for parallel execution
        inclusion_tasks = []
        for criterion in inclusion_list:
            prompt = build_per_criterion_prompt(
                criterion=criterion,
                source_content=eval_source_content,
                research_questions=research_questions,
                inclusion=True,
            )
            inclusion_tasks.append(self._evaluate_single_criterion(
                prompt, criterion, context_id if reuse_context else None
            ))

        exclusion_tasks = []
        for criterion in exclusion_list:
            prompt = build_per_criterion_prompt(
                criterion=criterion,
                source_content=eval_source_content,
                research_questions=research_questions,
                inclusion=False,
            )
            exclusion_tasks.append(self._evaluate_single_criterion(
                prompt, criterion, context_id if reuse_context else None
            ))

        # Execute all checks in parallel
        # Note: We use gather to run them all at once. 
        # Since we are likely using a small model or have a rate limit, the caller 
        # (ImportOrchestrator) should handle source-level concurrency. 
        # Here we handle criterion-level concurrency for a single source.
        
        inclusion_results_unordered = await asyncio.gather(*inclusion_tasks)
        exclusion_results_unordered = await asyncio.gather(*exclusion_tasks)

        # The results are already in order corresponding to the criteria lists 
        # because gather preserves order of the tasks list passed to it.
        inclusion_results = list(inclusion_results_unordered)
        exclusion_results = list(exclusion_results_unordered)

        # Deterministic recommendation logic
        inclusion_votes = [r["decision"] for r in inclusion_results]
        exclusion_votes = [r["decision"] for r in exclusion_results]
        
        # ALL inclusion criteria must be fulfilled
        all_inclusion_met = all(inclusion_votes) if inclusion_votes else True
        
        # NO exclusion criteria can be fulfilled
        no_exclusion_met = not any(exclusion_votes) if exclusion_votes else True
        
        # Final deterministic recommendation
        recommendation = all_inclusion_met and no_exclusion_met

        # Calculate overall confidence
        confidence_samples = [
            r["confidence"]
            for r in inclusion_results + exclusion_results
            if r.get("confidence") is not None
        ]
        overall_confidence = statistics.mean(confidence_samples) if confidence_samples else 0.5

        # Build reasoning summaries
        inclusion_reasoning = "; ".join(
            [r["reasoning"] for r in inclusion_results if r.get("reasoning")]
        )
        exclusion_reasoning = "; ".join(
            [r["reasoning"] for r in exclusion_results if r.get("reasoning")]
        )

        logger.info(
            "inclusion_evaluation: evaluation complete",
            extra={
                "inclusion_results_count": len(inclusion_results),
                "exclusion_results_count": len(exclusion_results),
                "inclusion_votes_true": inclusion_votes.count(True) if inclusion_votes else 0,
                "inclusion_votes_false": inclusion_votes.count(False) if inclusion_votes else 0,
                "exclusion_votes_true": exclusion_votes.count(True) if exclusion_votes else 0,
                "exclusion_votes_false": exclusion_votes.count(False) if exclusion_votes else 0,
                "all_inclusion_met": all_inclusion_met,
                "no_exclusion_met": no_exclusion_met,
                "final_recommendation": "include" if recommendation else "exclude",
                "overall_confidence": round(overall_confidence, 3),
                "duration_seconds": round(time.perf_counter() - start_time, 2),
            },
        )

        return {
            "recommendation": recommendation,
            "inclusion_reasoning": inclusion_reasoning or "Per-criterion inclusion analysis completed.",
            "exclusion_reasoning": exclusion_reasoning or "Per-criterion exclusion analysis completed.",
            "overall_confidence": overall_confidence,
            "inclusion_criteria": inclusion_results,
            "exclusion_criteria": exclusion_results,
            "relevance_score": overall_confidence,
            "context_response_id": context_id, # Return to caller for persistence
        }

    async def _evaluate_single_criterion(
        self, 
        prompt: str, 
        criterion: str, 
        context_id: str | None
    ) -> Dict[str, Any]:
        """Evaluate a single criterion (helper for parallel execution)."""
        try:
            result = await self.llm_provider.generate_structured_output(
                prompt=prompt,
                response_schema={
                    "criterion": "string",
                    "decision": "boolean",
                    "confidence": "number",
                    "reasoning": "string",
                },
                previous_response_id=context_id
            )
            return {
                "criterion": criterion,
                "decision": bool(result.get("decision")),
                "confidence": float(result.get("confidence", 0.5)),
                "reasoning": result.get("reasoning", ""),
            }
        except Exception as e:
            logger.exception(f"inclusion_evaluation: criterion failed: {criterion[:50]}...")
            return {
                "criterion": criterion,
                "decision": False,
                "confidence": 0.0,
                "reasoning": f"LLM error: {str(e)}",
            }
