"""Multi-LLM voting service for improved reliability in systematic reviews.

This service implements a multi-researcher voting paradigm using multiple LLMs.
Each LLM acts as an independent "researcher" evaluating sources against criteria.
The final decision is made by majority vote, mimicking traditional inter-rater
reliability approaches in systematic mapping studies.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from statistics import mean
from typing import Any

from src.core.llm_provider import LLMProvider

logger = logging.getLogger(__name__)


@dataclass
class VoteResult:
    """Result from a single LLM's vote on a criterion."""

    provider: str
    decision: bool
    confidence: float
    reasoning: str
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "provider": self.provider,
            "decision": self.decision,
            "confidence": self.confidence,
            "reasoning": self.reasoning,
            "error": self.error,
        }


@dataclass
class AggregatedVote:
    """Aggregated voting result across multiple LLMs."""

    criterion: str
    final_decision: bool
    vote_count: int  # Number of votes for the winning decision
    total_voters: int  # Total number of voters
    agreement_ratio: float  # e.g., 0.67 for 2/3 agreement
    individual_votes: list[VoteResult] = field(default_factory=list)
    aggregated_confidence: float = 0.5
    aggregated_reasoning: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "criterion": self.criterion,
            "final_decision": self.final_decision,
            "vote_count": self.vote_count,
            "total_voters": self.total_voters,
            "agreement_ratio": self.agreement_ratio,
            "individual_votes": [v.to_dict() for v in self.individual_votes],
            "aggregated_confidence": self.aggregated_confidence,
            "aggregated_reasoning": self.aggregated_reasoning,
        }


@dataclass
class VotingSummary:
    """Summary of voting across all criteria."""

    total_providers: int
    providers_used: list[str]
    overall_agreement_ratio: float
    total_criteria_evaluated: int
    unanimous_decisions: int
    split_decisions: int

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "total_providers": self.total_providers,
            "providers_used": self.providers_used,
            "overall_agreement_ratio": self.overall_agreement_ratio,
            "total_criteria_evaluated": self.total_criteria_evaluated,
            "unanimous_decisions": self.unanimous_decisions,
            "split_decisions": self.split_decisions,
        }


class MultiLLMVotingService:
    """Service for multi-LLM consensus voting.

    Implements the multi-researcher paradigm from systematic mapping study methodology:
    - Each LLM independently evaluates each criterion
    - Pure majority voting determines the final decision (no confidence weighting)
    - Falls back to fewer providers if one fails (minimum 2 required for valid vote)
    - Stores individual votes for audit trail
    """

    def __init__(self, providers: list[LLMProvider]):
        """Initialize with list of LLM providers.

        Args:
            providers: List of LLMProvider instances to use for voting.
                      Must have at least 2 providers.
        """
        if len(providers) < 2:
            raise ValueError(
                f"MultiLLMVotingService requires at least 2 providers. Got {len(providers)}."
            )
        self.providers = providers
        self.provider_names = [type(p).__name__.replace("Provider", "").lower() for p in providers]

    async def vote_on_criterion(
        self,
        prompt: str,
        criterion: str,
        response_schema: dict[str, Any],
    ) -> AggregatedVote:
        """
        Have all providers vote on a single criterion.
        Returns aggregated result with majority decision.

        Args:
            prompt: The prompt to send to each LLM
            criterion: The criterion text being evaluated
            response_schema: Expected response schema for structured output

        Returns:
            AggregatedVote with final decision and individual votes
        """
        # Run all providers in parallel
        tasks = [
            self._get_single_vote(provider, name, prompt, response_schema)
            for provider, name in zip(self.providers, self.provider_names, strict=True)
        ]

        votes: list[VoteResult] = await asyncio.gather(*tasks)

        # Filter out failed votes (but keep track of them)
        valid_votes = [v for v in votes if v.error is None]
        failed_votes = [v for v in votes if v.error is not None]

        if len(valid_votes) < 2:
            # Not enough valid votes for a meaningful majority
            logger.error(
                f"Insufficient valid votes for criterion '{criterion[:50]}...': "
                f"{len(valid_votes)} valid, {len(failed_votes)} failed"
            )
            # Return a failed result
            return AggregatedVote(
                criterion=criterion,
                final_decision=False,
                vote_count=0,
                total_voters=len(votes),
                agreement_ratio=0.0,
                individual_votes=votes,
                aggregated_confidence=0.0,
                aggregated_reasoning="Insufficient valid votes from LLM providers",
            )

        # Pure majority voting (each LLM gets 1 vote regardless of confidence)
        positive_votes = sum(1 for v in valid_votes if v.decision)
        negative_votes = len(valid_votes) - positive_votes
        majority_threshold = len(valid_votes) / 2

        final_decision = positive_votes > majority_threshold
        vote_count = positive_votes if final_decision else negative_votes

        # Calculate agreement ratio
        agreement_ratio = vote_count / len(valid_votes)

        # Aggregate confidence from agreeing voters only
        agreeing_votes = [v for v in valid_votes if v.decision == final_decision]
        aggregated_confidence = (
            mean([v.confidence for v in agreeing_votes]) if agreeing_votes else 0.5
        )

        # Combine reasoning from agreeing voters
        reasoning_parts = []
        for v in agreeing_votes:
            if v.reasoning:
                reasoning_parts.append(f"[{v.provider}] {v.reasoning}")
        aggregated_reasoning = " | ".join(reasoning_parts) if reasoning_parts else ""

        logger.info(
            f"Voting complete for criterion '{criterion[:50]}...': "
            f"decision={final_decision}, votes={positive_votes}/{len(valid_votes)}, "
            f"agreement={agreement_ratio:.2f}"
        )

        return AggregatedVote(
            criterion=criterion,
            final_decision=final_decision,
            vote_count=vote_count,
            total_voters=len(votes),
            agreement_ratio=agreement_ratio,
            individual_votes=votes,
            aggregated_confidence=aggregated_confidence,
            aggregated_reasoning=aggregated_reasoning,
        )

    async def _get_single_vote(
        self,
        provider: LLMProvider,
        provider_name: str,
        prompt: str,
        response_schema: dict[str, Any],
    ) -> VoteResult:
        """Get a single provider's vote.

        Args:
            provider: The LLM provider to use
            provider_name: Name of the provider (for logging/tracking)
            prompt: The prompt to send
            response_schema: Expected response schema

        Returns:
            VoteResult with the provider's decision
        """
        try:
            result = await provider.generate_structured_output(
                prompt=prompt,
                response_schema=response_schema,
            )

            return VoteResult(
                provider=provider_name,
                decision=bool(result.get("decision", False)),
                confidence=float(result.get("confidence", 0.5)),
                reasoning=result.get("reasoning", ""),
                error=None,
            )
        except Exception as e:
            logger.error(f"Vote failed for {provider_name}: {e}")
            # Return a vote with error flag (will be excluded from majority calculation)
            return VoteResult(
                provider=provider_name,
                decision=False,
                confidence=0.0,
                reasoning="",
                error=str(e),
            )

    def compute_voting_summary(self, aggregated_votes: list[AggregatedVote]) -> VotingSummary:
        """Compute summary statistics across all voting results.

        Args:
            aggregated_votes: List of AggregatedVote results

        Returns:
            VotingSummary with overall statistics
        """
        if not aggregated_votes:
            return VotingSummary(
                total_providers=len(self.providers),
                providers_used=self.provider_names,
                overall_agreement_ratio=0.0,
                total_criteria_evaluated=0,
                unanimous_decisions=0,
                split_decisions=0,
            )

        # Count unanimous vs split decisions
        unanimous = sum(1 for v in aggregated_votes if v.agreement_ratio == 1.0)
        split = len(aggregated_votes) - unanimous

        # Average agreement ratio
        avg_agreement = mean([v.agreement_ratio for v in aggregated_votes])

        return VotingSummary(
            total_providers=len(self.providers),
            providers_used=self.provider_names,
            overall_agreement_ratio=avg_agreement,
            total_criteria_evaluated=len(aggregated_votes),
            unanimous_decisions=unanimous,
            split_decisions=split,
        )
