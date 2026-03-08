"""Tests for the inclusion evaluation service."""

import pytest

from src.services.inclusion_evaluation_service import InclusionEvaluationService
from src.services.multi_llm_voting_service import MultiLLMVotingService

# --- Criteria Validation ---


class TestValidateCriteria:
    def test_valid_string_criteria(self):
        assert InclusionEvaluationService.validate_criteria(
            ["criterion 1", "criterion 2"], ["exclusion 1"]
        )

    def test_valid_dict_criteria(self):
        assert InclusionEvaluationService.validate_criteria(
            [{"criterion": "C1"}], [{"criterion": "E1"}]
        )

    def test_valid_mixed_criteria(self):
        assert InclusionEvaluationService.validate_criteria(
            ["string criterion", {"criterion": "dict criterion"}], []
        )

    def test_empty_criteria_lists_are_valid(self):
        assert InclusionEvaluationService.validate_criteria([], [])

    def test_rejects_non_list_inclusion(self):
        with pytest.raises(ValueError, match="must be a list"):
            InclusionEvaluationService.validate_criteria("not a list", [])

    def test_rejects_non_list_exclusion(self):
        with pytest.raises(ValueError, match="must be a list"):
            InclusionEvaluationService.validate_criteria([], "not a list")

    def test_rejects_empty_string_criterion(self):
        with pytest.raises(ValueError, match="empty string"):
            InclusionEvaluationService.validate_criteria([""], [])

    def test_rejects_whitespace_only_criterion(self):
        with pytest.raises(ValueError, match="empty string"):
            InclusionEvaluationService.validate_criteria(["  "], [])

    def test_rejects_dict_missing_criterion_key(self):
        with pytest.raises(ValueError, match="missing 'criterion' field"):
            InclusionEvaluationService.validate_criteria([{"text": "foo"}], [])

    def test_rejects_dict_with_empty_criterion(self):
        with pytest.raises(ValueError, match="empty or invalid"):
            InclusionEvaluationService.validate_criteria([{"criterion": ""}], [])

    def test_rejects_invalid_type(self):
        with pytest.raises(ValueError, match="must be a string or dict"):
            InclusionEvaluationService.validate_criteria([42], [])

    def test_validates_exclusion_criteria_too(self):
        with pytest.raises(ValueError, match="Exclusion criterion"):
            InclusionEvaluationService.validate_criteria([], [""])


# --- Constructor ---


def test_single_llm_mode(fake_provider):
    service = InclusionEvaluationService(llm_provider=fake_provider, use_voting=False)
    assert service.use_voting is False
    assert service.llm_provider is fake_provider


def test_voting_mode_with_service(fake_provider_factory):
    providers = [fake_provider_factory(), fake_provider_factory()]
    voting = MultiLLMVotingService(providers)
    service = InclusionEvaluationService(voting_service=voting, use_voting=True)
    assert service.use_voting is True


def test_raises_without_provider_in_single_mode():
    with pytest.raises(ValueError, match="Either llm_provider"):
        InclusionEvaluationService(llm_provider=None, use_voting=False)


# --- Single-LLM Evaluation ---


@pytest.mark.asyncio
async def test_single_llm_all_inclusion_met(fake_provider_factory):
    provider = fake_provider_factory(decision=True, confidence=0.9, reasoning="matches")
    service = InclusionEvaluationService(llm_provider=provider, use_voting=False)

    result = await service.evaluate_inclusion(
        source_content={"title": "Test", "abstract": "Something"},
        inclusion_criteria=["C1", "C2"],
        exclusion_criteria=[],
    )

    assert result["recommendation"] is True
    assert result["voting_enabled"] is False
    assert len(result["inclusion_criteria"]) == 2
    assert all(c["decision"] for c in result["inclusion_criteria"])


@pytest.mark.asyncio
async def test_single_llm_inclusion_not_met(fake_provider_factory):
    provider = fake_provider_factory(decision=False)
    service = InclusionEvaluationService(llm_provider=provider, use_voting=False)

    result = await service.evaluate_inclusion(
        source_content={"title": "Test", "abstract": "Something"},
        inclusion_criteria=["C1"],
        exclusion_criteria=[],
    )

    assert result["recommendation"] is False


@pytest.mark.asyncio
async def test_single_llm_exclusion_triggers_exclude(fake_provider_factory):
    """If exclusion criterion matches, recommendation is False regardless of inclusion."""
    provider = fake_provider_factory(decision=True)
    service = InclusionEvaluationService(llm_provider=provider, use_voting=False)

    result = await service.evaluate_inclusion(
        source_content={"title": "Test", "abstract": "Something"},
        inclusion_criteria=["C1"],
        exclusion_criteria=["E1"],
    )

    # inclusion=True, but exclusion=True too -> recommendation=False
    assert result["recommendation"] is False


@pytest.mark.asyncio
async def test_empty_criteria_defaults_to_include(fake_provider):
    service = InclusionEvaluationService(llm_provider=fake_provider, use_voting=False)

    result = await service.evaluate_inclusion(
        source_content={"title": "Test", "abstract": "Something"},
        inclusion_criteria=[],
        exclusion_criteria=[],
    )

    assert result["recommendation"] is True
    assert result["overall_confidence"] == 0.5  # default when no criteria


@pytest.mark.asyncio
async def test_single_llm_handles_dict_criteria(fake_provider_factory):
    provider = fake_provider_factory(decision=True)
    service = InclusionEvaluationService(llm_provider=provider, use_voting=False)

    result = await service.evaluate_inclusion(
        source_content={"title": "Test", "abstract": "Something"},
        inclusion_criteria=[{"criterion": "Must relate to AI"}],
        exclusion_criteria=[],
    )

    assert result["recommendation"] is True
    assert len(result["inclusion_criteria"]) == 1


@pytest.mark.asyncio
async def test_single_llm_provider_error_returns_failed_criterion(fake_provider_factory):
    provider = fake_provider_factory()
    provider.set_error(RuntimeError("API timeout"))
    service = InclusionEvaluationService(llm_provider=provider, use_voting=False)

    result = await service.evaluate_inclusion(
        source_content={"title": "Test", "abstract": "Something"},
        inclusion_criteria=["C1"],
        exclusion_criteria=[],
    )

    # Error on criterion -> decision=False -> recommendation=False
    assert result["recommendation"] is False
    assert "LLM error" in result["inclusion_criteria"][0]["reasoning"]


# --- Voting-Mode Evaluation ---


@pytest.mark.asyncio
async def test_voting_mode_unanimous_include(fake_provider_factory):
    providers = [
        fake_provider_factory(decision=True, confidence=0.9),
        fake_provider_factory(decision=True, confidence=0.85),
        fake_provider_factory(decision=True, confidence=0.8),
    ]
    voting = MultiLLMVotingService(providers)
    service = InclusionEvaluationService(voting_service=voting, use_voting=True)

    result = await service.evaluate_inclusion(
        source_content={"title": "Test", "abstract": "Relevant"},
        inclusion_criteria=["C1"],
        exclusion_criteria=[],
    )

    assert result["recommendation"] is True
    assert result["voting_enabled"] is True
    assert result["voting_summary"] is not None
    assert result["voting_summary"]["unanimous_decisions"] == 1


@pytest.mark.asyncio
async def test_voting_mode_exclusion_overrides(fake_provider_factory):
    providers = [
        fake_provider_factory(decision=True),
        fake_provider_factory(decision=True),
    ]
    voting = MultiLLMVotingService(providers)
    service = InclusionEvaluationService(voting_service=voting, use_voting=True)

    result = await service.evaluate_inclusion(
        source_content={"title": "Test", "abstract": "Something"},
        inclusion_criteria=["C1"],
        exclusion_criteria=["E1"],
    )

    # Both criteria match -> inclusion met BUT exclusion also met -> exclude
    assert result["recommendation"] is False


# --- Confidence Aggregation ---


@pytest.mark.asyncio
async def test_overall_confidence_is_mean(fake_provider_factory):
    provider = fake_provider_factory(decision=True, confidence=0.8)
    service = InclusionEvaluationService(llm_provider=provider, use_voting=False)

    result = await service.evaluate_inclusion(
        source_content={"title": "Test", "abstract": "Something"},
        inclusion_criteria=["C1", "C2"],
        exclusion_criteria=["E1"],
    )

    # All criteria return confidence 0.8, mean should be 0.8
    assert result["overall_confidence"] == pytest.approx(0.8)


# --- Result Structure ---


@pytest.mark.asyncio
async def test_result_contains_expected_keys(fake_provider):
    service = InclusionEvaluationService(llm_provider=fake_provider, use_voting=False)

    result = await service.evaluate_inclusion(
        source_content={"title": "Test", "abstract": "Something"},
        inclusion_criteria=["C1"],
        exclusion_criteria=["E1"],
    )

    expected_keys = {
        "recommendation",
        "inclusion_reasoning",
        "exclusion_reasoning",
        "overall_confidence",
        "inclusion_criteria",
        "exclusion_criteria",
        "relevance_score",
        "context_response_id",
        "voting_enabled",
        "voting_summary",
    }
    assert set(result.keys()) == expected_keys
