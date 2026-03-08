"""Tests for the multi-LLM voting service."""

import pytest

from src.services.multi_llm_voting_service import (
    AggregatedVote,
    MultiLLMVotingService,
    VoteResult,
    VotingSummary,
)

# --- Constructor ---


def test_requires_minimum_two_providers(fake_provider_factory):
    with pytest.raises(ValueError, match="at least 2 providers"):
        MultiLLMVotingService([fake_provider_factory()])


def test_accepts_two_providers(fake_provider_factory):
    service = MultiLLMVotingService([fake_provider_factory(), fake_provider_factory()])
    assert len(service.providers) == 2


def test_provider_names_extracted(fake_provider_factory):
    service = MultiLLMVotingService([fake_provider_factory(), fake_provider_factory()])
    # FakeProvider -> "fake"
    assert service.provider_names == ["fake", "fake"]


# --- Voting Logic ---


@pytest.mark.asyncio
async def test_unanimous_positive(fake_provider_factory):
    providers = [fake_provider_factory(decision=True) for _ in range(3)]
    service = MultiLLMVotingService(providers)

    result = await service.vote_on_criterion(
        prompt="test prompt",
        criterion="test criterion",
        response_schema={"decision": "boolean"},
    )

    assert result.final_decision is True
    assert result.vote_count == 3
    assert result.total_voters == 3
    assert result.agreement_ratio == 1.0


@pytest.mark.asyncio
async def test_unanimous_negative(fake_provider_factory):
    providers = [fake_provider_factory(decision=False) for _ in range(3)]
    service = MultiLLMVotingService(providers)

    result = await service.vote_on_criterion(
        prompt="test prompt",
        criterion="test criterion",
        response_schema={"decision": "boolean"},
    )

    assert result.final_decision is False
    assert result.vote_count == 3
    assert result.agreement_ratio == 1.0


@pytest.mark.asyncio
async def test_majority_two_to_one(fake_provider_factory):
    providers = [
        fake_provider_factory(decision=True),
        fake_provider_factory(decision=True),
        fake_provider_factory(decision=False),
    ]
    service = MultiLLMVotingService(providers)

    result = await service.vote_on_criterion(
        prompt="test", criterion="C1", response_schema={"decision": "boolean"}
    )

    assert result.final_decision is True
    assert result.vote_count == 2
    assert result.total_voters == 3
    assert result.agreement_ratio == pytest.approx(2 / 3)


@pytest.mark.asyncio
async def test_majority_one_to_two(fake_provider_factory):
    providers = [
        fake_provider_factory(decision=True),
        fake_provider_factory(decision=False),
        fake_provider_factory(decision=False),
    ]
    service = MultiLLMVotingService(providers)

    result = await service.vote_on_criterion(
        prompt="test", criterion="C1", response_schema={"decision": "boolean"}
    )

    assert result.final_decision is False
    assert result.vote_count == 2


@pytest.mark.asyncio
async def test_tie_goes_negative_with_two_providers(fake_provider_factory):
    """With 2 providers and a 1-1 tie, positive_votes == majority_threshold (not >), so False."""
    providers = [
        fake_provider_factory(decision=True),
        fake_provider_factory(decision=False),
    ]
    service = MultiLLMVotingService(providers)

    result = await service.vote_on_criterion(
        prompt="test", criterion="C1", response_schema={"decision": "boolean"}
    )

    # 1 positive out of 2 -> 1 > 1.0 is False -> decision is False
    assert result.final_decision is False


# --- Confidence Aggregation ---


@pytest.mark.asyncio
async def test_confidence_from_agreeing_voters_only(fake_provider_factory):
    providers = [
        fake_provider_factory(decision=True, confidence=0.9),
        fake_provider_factory(decision=True, confidence=0.7),
        fake_provider_factory(decision=False, confidence=0.95),
    ]
    service = MultiLLMVotingService(providers)

    result = await service.vote_on_criterion(
        prompt="test", criterion="C1", response_schema={"decision": "boolean"}
    )

    assert result.final_decision is True
    # Confidence from agreeing voters (0.9, 0.7), not the dissenter (0.95)
    assert result.aggregated_confidence == pytest.approx(0.8)


# --- Reasoning Aggregation ---


@pytest.mark.asyncio
async def test_reasoning_from_agreeing_voters(fake_provider_factory):
    providers = [
        fake_provider_factory(decision=True, reasoning="good paper"),
        fake_provider_factory(decision=True, reasoning="relevant topic"),
        fake_provider_factory(decision=False, reasoning="not relevant"),
    ]
    service = MultiLLMVotingService(providers)

    result = await service.vote_on_criterion(
        prompt="test", criterion="C1", response_schema={"decision": "boolean"}
    )

    assert "good paper" in result.aggregated_reasoning
    assert "relevant topic" in result.aggregated_reasoning
    assert "not relevant" not in result.aggregated_reasoning


# --- Error Handling ---


@pytest.mark.asyncio
async def test_one_provider_fails_still_votes(fake_provider_factory):
    """If one of three providers fails, the remaining two still produce a valid vote."""
    failing = fake_provider_factory()
    failing.set_error(RuntimeError("API error"))

    providers = [
        fake_provider_factory(decision=True),
        fake_provider_factory(decision=True),
        failing,
    ]
    service = MultiLLMVotingService(providers)

    result = await service.vote_on_criterion(
        prompt="test", criterion="C1", response_schema={"decision": "boolean"}
    )

    assert result.final_decision is True
    assert result.vote_count == 2
    assert result.total_voters == 3


@pytest.mark.asyncio
async def test_insufficient_valid_votes(fake_provider_factory):
    """If too many providers fail, returns failed result."""
    failing1 = fake_provider_factory()
    failing1.set_error(RuntimeError("fail1"))
    failing2 = fake_provider_factory()
    failing2.set_error(RuntimeError("fail2"))

    providers = [fake_provider_factory(decision=True), failing1, failing2]
    service = MultiLLMVotingService(providers)

    result = await service.vote_on_criterion(
        prompt="test", criterion="C1", response_schema={"decision": "boolean"}
    )

    assert result.final_decision is False
    assert result.vote_count == 0
    assert result.agreement_ratio == 0.0
    assert "Insufficient" in result.aggregated_reasoning


@pytest.mark.asyncio
async def test_all_providers_fail(fake_provider_factory):
    failing1 = fake_provider_factory()
    failing1.set_error(RuntimeError("fail1"))
    failing2 = fake_provider_factory()
    failing2.set_error(RuntimeError("fail2"))

    service = MultiLLMVotingService([failing1, failing2])

    result = await service.vote_on_criterion(
        prompt="test", criterion="C1", response_schema={"decision": "boolean"}
    )

    assert result.final_decision is False
    assert result.agreement_ratio == 0.0


# --- Voting Summary ---


def test_compute_summary_empty(fake_provider_factory):
    service = MultiLLMVotingService([fake_provider_factory(), fake_provider_factory()])
    summary = service.compute_voting_summary([])

    assert summary.total_criteria_evaluated == 0
    assert summary.unanimous_decisions == 0
    assert summary.split_decisions == 0
    assert summary.overall_agreement_ratio == 0.0


def test_compute_summary_unanimous_and_split(fake_provider_factory):
    service = MultiLLMVotingService([fake_provider_factory(), fake_provider_factory()])

    votes = [
        AggregatedVote(
            criterion="C1",
            final_decision=True,
            vote_count=3,
            total_voters=3,
            agreement_ratio=1.0,
        ),
        AggregatedVote(
            criterion="C2",
            final_decision=False,
            vote_count=2,
            total_voters=3,
            agreement_ratio=2 / 3,
        ),
    ]

    summary = service.compute_voting_summary(votes)

    assert summary.total_criteria_evaluated == 2
    assert summary.unanimous_decisions == 1
    assert summary.split_decisions == 1
    assert summary.overall_agreement_ratio == pytest.approx((1.0 + 2 / 3) / 2)


# --- Serialization ---


def test_vote_result_to_dict():
    vote = VoteResult(provider="claude", decision=True, confidence=0.9, reasoning="looks good")
    d = vote.to_dict()
    assert d["provider"] == "claude"
    assert d["decision"] is True
    assert d["error"] is None


def test_aggregated_vote_to_dict():
    vote = AggregatedVote(
        criterion="C1",
        final_decision=True,
        vote_count=2,
        total_voters=3,
        agreement_ratio=2 / 3,
        individual_votes=[
            VoteResult(provider="a", decision=True, confidence=0.9, reasoning="yes"),
        ],
    )
    d = vote.to_dict()
    assert len(d["individual_votes"]) == 1
    assert d["criterion"] == "C1"


def test_voting_summary_to_dict():
    summary = VotingSummary(
        total_providers=3,
        providers_used=["claude", "openai", "gemini"],
        overall_agreement_ratio=0.85,
        total_criteria_evaluated=5,
        unanimous_decisions=3,
        split_decisions=2,
    )
    d = summary.to_dict()
    assert d["total_providers"] == 3
    assert d["providers_used"] == ["claude", "openai", "gemini"]
