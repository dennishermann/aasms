"""Inclusion/Exclusion evaluation service for systematic mapping studies.

Supports both single-LLM and multi-LLM voting modes for inter-rater reliability.
When multiple LLM providers are configured (3+), voting is automatically enabled.
"""

import asyncio
import logging
import statistics
import time
from typing import Any

from src.core.context_cache import initialize_context, normalize_criteria
from src.core.llm_provider import LLMProvider, get_voting_providers, voting_available
from src.core.prompts import build_per_criterion_prompt
from src.services.multi_llm_voting_service import (
    AggregatedVote,
    MultiLLMVotingService,
)

logger = logging.getLogger(__name__)


class InclusionEvaluationService:
    """Service for evaluating sources against inclusion/exclusion criteria.

    Supports two modes:
    1. Single-LLM mode: Uses a single LLM provider for evaluation
    2. Multi-LLM voting mode: Uses multiple LLM providers with majority voting

    Voting mode is automatically enabled when 2+ providers are configured.
    """

    def __init__(
        self,
        llm_provider: LLMProvider | None = None,
        voting_service: MultiLLMVotingService | None = None,
        use_voting: bool | None = None,
    ):
        """Initialize the evaluation service.

        Args:
            llm_provider: Single LLM provider for non-voting mode
            voting_service: Pre-configured voting service (optional)
            use_voting: Force voting on/off. If None, auto-detect based on available providers.
        """
        self.llm_provider = llm_provider
        self.voting_service = voting_service

        # Auto-detect voting mode if not explicitly set
        if use_voting is None:
            self.use_voting = voting_available()
        else:
            self.use_voting = use_voting

        # Initialize voting service if needed and not provided
        if self.use_voting and self.voting_service is None:
            try:
                providers = get_voting_providers(prefer_small_model=True)
                self.voting_service = MultiLLMVotingService(providers)
                logger.info(
                    f"Multi-LLM voting enabled with {len(providers)} providers: "
                    f"{[type(p).__name__ for p in providers]}"
                )
            except ValueError as e:
                logger.warning(f"Could not enable voting: {e}. Falling back to single-LLM mode.")
                self.use_voting = False

        # Ensure we have at least one provider
        if not self.use_voting and self.llm_provider is None:
            raise ValueError(
                "Either llm_provider must be provided for single-LLM mode, "
                "or voting must be available for multi-LLM mode."
            )

    @staticmethod
    def validate_criteria(inclusion_criteria: list[Any], exclusion_criteria: list[Any]) -> bool:
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
                if (
                    not isinstance(criterion["criterion"], str)
                    or not criterion["criterion"].strip()
                ):
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
                if (
                    not isinstance(criterion["criterion"], str)
                    or not criterion["criterion"].strip()
                ):
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
        source_content: dict[str, Any],
        inclusion_criteria: list[Any],
        exclusion_criteria: list[Any],
        research_questions: list[str] | None = None,
        previous_response_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Evaluate source against inclusion/exclusion criteria.

        Automatically uses multi-LLM voting if available, otherwise falls back
        to single-LLM evaluation.

        Args:
            source_content: Dictionary containing source text and metadata
            inclusion_criteria: List of inclusion criteria
            exclusion_criteria: List of exclusion criteria
            research_questions: List of research questions for context
            previous_response_id: Optional context ID for conversation continuity

        Returns:
            Dictionary containing recommendation, reasoning, per-criterion results,
            and voting details if voting was used.
        """
        if self.use_voting and self.voting_service:
            return await self._evaluate_with_voting(
                source_content=source_content,
                inclusion_criteria=inclusion_criteria,
                exclusion_criteria=exclusion_criteria,
                research_questions=research_questions,
            )
        else:
            return await self._evaluate_single_llm(
                source_content=source_content,
                inclusion_criteria=inclusion_criteria,
                exclusion_criteria=exclusion_criteria,
                research_questions=research_questions,
                previous_response_id=previous_response_id,
            )

    async def _evaluate_with_voting(
        self,
        source_content: dict[str, Any],
        inclusion_criteria: list[Any],
        exclusion_criteria: list[Any],
        research_questions: list[str] | None = None,
    ) -> dict[str, Any]:
        """Evaluate using multi-LLM voting for improved reliability."""
        research_questions = research_questions or []

        inclusion_list = normalize_criteria(inclusion_criteria)
        exclusion_list = normalize_criteria(exclusion_criteria)

        start_time = time.perf_counter()

        logger.info(
            "inclusion_evaluation: starting VOTING evaluation",
            extra={
                "mode": "voting",
                "providers": self.voting_service.provider_names,
                "inclusion_criteria_count": len(inclusion_list),
                "exclusion_criteria_count": len(exclusion_list),
                "research_questions_count": len(research_questions),
                "title": (source_content.get("title") or "")[:120],
            },
        )

        # Response schema for criterion evaluation
        response_schema = {
            "criterion": "string",
            "decision": "boolean",
            "confidence": "number",
            "reasoning": "string",
        }

        # Create voting tasks for all criteria
        inclusion_tasks = []
        for criterion in inclusion_list:
            prompt = build_per_criterion_prompt(
                criterion=criterion,
                source_content=source_content,
                research_questions=research_questions,
                inclusion=True,
            )
            inclusion_tasks.append(
                self.voting_service.vote_on_criterion(prompt, criterion, response_schema)
            )

        exclusion_tasks = []
        for criterion in exclusion_list:
            prompt = build_per_criterion_prompt(
                criterion=criterion,
                source_content=source_content,
                research_questions=research_questions,
                inclusion=False,
            )
            exclusion_tasks.append(
                self.voting_service.vote_on_criterion(prompt, criterion, response_schema)
            )

        # Execute all voting in parallel
        inclusion_votes: list[AggregatedVote] = await asyncio.gather(*inclusion_tasks)
        exclusion_votes: list[AggregatedVote] = await asyncio.gather(*exclusion_tasks)

        # Convert to result format with voting details
        inclusion_results = []
        for vote in inclusion_votes:
            inclusion_results.append(
                {
                    "criterion": vote.criterion,
                    "decision": vote.final_decision,
                    "confidence": vote.aggregated_confidence,
                    "reasoning": vote.aggregated_reasoning,
                    "voting_details": {
                        "votes": [v.to_dict() for v in vote.individual_votes],
                        "agreement_ratio": vote.agreement_ratio,
                        "vote_count": vote.vote_count,
                        "total_voters": vote.total_voters,
                    },
                }
            )

        exclusion_results = []
        for vote in exclusion_votes:
            exclusion_results.append(
                {
                    "criterion": vote.criterion,
                    "decision": vote.final_decision,
                    "confidence": vote.aggregated_confidence,
                    "reasoning": vote.aggregated_reasoning,
                    "voting_details": {
                        "votes": [v.to_dict() for v in vote.individual_votes],
                        "agreement_ratio": vote.agreement_ratio,
                        "vote_count": vote.vote_count,
                        "total_voters": vote.total_voters,
                    },
                }
            )

        # Deterministic recommendation logic (same as single-LLM)
        inclusion_decisions = [r["decision"] for r in inclusion_results]
        exclusion_decisions = [r["decision"] for r in exclusion_results]

        all_inclusion_met = all(inclusion_decisions) if inclusion_decisions else True
        no_exclusion_met = not any(exclusion_decisions) if exclusion_decisions else True
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

        # Compute voting summary
        all_votes = inclusion_votes + exclusion_votes
        voting_summary = self.voting_service.compute_voting_summary(all_votes)

        duration = time.perf_counter() - start_time

        logger.info(
            "inclusion_evaluation: VOTING evaluation complete",
            extra={
                "mode": "voting",
                "providers": self.voting_service.provider_names,
                "inclusion_results_count": len(inclusion_results),
                "exclusion_results_count": len(exclusion_results),
                "all_inclusion_met": all_inclusion_met,
                "no_exclusion_met": no_exclusion_met,
                "final_recommendation": "include" if recommendation else "exclude",
                "overall_confidence": round(overall_confidence, 3),
                "overall_agreement": round(voting_summary.overall_agreement_ratio, 3),
                "unanimous_decisions": voting_summary.unanimous_decisions,
                "split_decisions": voting_summary.split_decisions,
                "duration_seconds": round(duration, 2),
            },
        )

        return {
            "recommendation": recommendation,
            "inclusion_reasoning": inclusion_reasoning
            or "Per-criterion inclusion analysis completed.",
            "exclusion_reasoning": exclusion_reasoning
            or "Per-criterion exclusion analysis completed.",
            "overall_confidence": overall_confidence,
            "inclusion_criteria": inclusion_results,
            "exclusion_criteria": exclusion_results,
            "relevance_score": overall_confidence,
            "context_response_id": None,  # Not used in voting mode
            # Voting-specific fields
            "voting_enabled": True,
            "voting_summary": voting_summary.to_dict(),
        }

    async def _evaluate_single_llm(
        self,
        source_content: dict[str, Any],
        inclusion_criteria: list[Any],
        exclusion_criteria: list[Any],
        research_questions: list[str] | None = None,
        previous_response_id: str | None = None,
    ) -> dict[str, Any]:
        """Evaluate using a single LLM (original implementation)."""
        research_questions = research_questions or []

        inclusion_list = normalize_criteria(inclusion_criteria)
        exclusion_list = normalize_criteria(exclusion_criteria)

        start_time = time.perf_counter()

        logger.info(
            "inclusion_evaluation: starting single-LLM evaluation",
            extra={
                "mode": "single_llm",
                "inclusion_criteria_count": len(inclusion_list),
                "exclusion_criteria_count": len(exclusion_list),
                "research_questions_count": len(research_questions),
                "title": (source_content.get("title") or "")[:120],
                "abstract_length": len(source_content.get("abstract") or ""),
                "has_content_excerpt": bool(source_content.get("content_excerpt")),
                "content_excerpt_length": len(source_content.get("content_excerpt") or ""),
            },
        )

        # Context caching for OpenAI
        context_id, eval_source_content = await initialize_context(
            self.llm_provider, source_content, previous_response_id, purpose="questions about it"
        )
        reuse_context = context_id is not None

        # Create tasks for parallel execution
        inclusion_tasks = []
        for criterion in inclusion_list:
            prompt = build_per_criterion_prompt(
                criterion=criterion,
                source_content=eval_source_content,
                research_questions=research_questions,
                inclusion=True,
            )
            inclusion_tasks.append(
                self._evaluate_single_criterion(
                    prompt, criterion, context_id if reuse_context else None
                )
            )

        exclusion_tasks = []
        for criterion in exclusion_list:
            prompt = build_per_criterion_prompt(
                criterion=criterion,
                source_content=eval_source_content,
                research_questions=research_questions,
                inclusion=False,
            )
            exclusion_tasks.append(
                self._evaluate_single_criterion(
                    prompt, criterion, context_id if reuse_context else None
                )
            )

        inclusion_results = list(await asyncio.gather(*inclusion_tasks))
        exclusion_results = list(await asyncio.gather(*exclusion_tasks))

        # Deterministic recommendation logic
        inclusion_votes = [r["decision"] for r in inclusion_results]
        exclusion_votes = [r["decision"] for r in exclusion_results]

        all_inclusion_met = all(inclusion_votes) if inclusion_votes else True
        no_exclusion_met = not any(exclusion_votes) if exclusion_votes else True
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
            "inclusion_evaluation: single-LLM evaluation complete",
            extra={
                "mode": "single_llm",
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
            "inclusion_reasoning": inclusion_reasoning
            or "Per-criterion inclusion analysis completed.",
            "exclusion_reasoning": exclusion_reasoning
            or "Per-criterion exclusion analysis completed.",
            "overall_confidence": overall_confidence,
            "inclusion_criteria": inclusion_results,
            "exclusion_criteria": exclusion_results,
            "relevance_score": overall_confidence,
            "context_response_id": context_id,
            # Single-LLM mode doesn't have voting
            "voting_enabled": False,
            "voting_summary": None,
        }

    async def _evaluate_single_criterion(
        self, prompt: str, criterion: str, context_id: str | None
    ) -> dict[str, Any]:
        """Evaluate a single criterion (helper for parallel execution in single-LLM mode)."""
        try:
            result = await self.llm_provider.generate_structured_output(
                prompt=prompt,
                response_schema={
                    "criterion": "string",
                    "decision": "boolean",
                    "confidence": "number",
                    "reasoning": "string",
                },
                previous_response_id=context_id,
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
