import importlib

import pytest

from src.core import config as config_module
from src.core import llm_provider as lp
from src.services.classification_service import ClassificationService
from src.services.inclusion_evaluation_service import InclusionEvaluationService


@pytest.mark.asyncio
async def test_evaluate_inclusion_recommendation_changes_with_exclusion(fake_provider_factory):
    source_content = {"title": "Test", "abstract": "Something", "content": "body"}
    provider = fake_provider_factory(decision=True)
    service = InclusionEvaluationService(llm_provider=provider, use_voting=False)

    # Test 1: Inclusion only (Expect True)
    result = await service.evaluate_inclusion(
        source_content=source_content,
        inclusion_criteria=["C1", "C2"],
        exclusion_criteria=[],
        research_questions=["RQ1"],
    )
    assert result["recommendation"] is True

    # Test 2: With Exclusion (Expect False because E1 will be 'decided' as True -> Excluded)
    provider2 = fake_provider_factory(decision=True)
    service2 = InclusionEvaluationService(llm_provider=provider2, use_voting=False)
    result_negative = await service2.evaluate_inclusion(
        source_content=source_content,
        inclusion_criteria=["C1"],
        exclusion_criteria=["E1"],
        research_questions=["RQ1"],
    )
    assert result_negative["recommendation"] is False


@pytest.mark.asyncio
async def test_classification_formatting_handles_list_schema(fake_provider_factory):
    source_content = {"title": "Test", "abstract": "Something", "content": "body"}
    schema = [{"name": "venue", "categories": ["journal", "conference"]}]
    provider = fake_provider_factory(decision=True)
    classification_service = ClassificationService(provider)

    classifications = await classification_service.classify_source(
        source_content=source_content,
        classification_schema=schema,
        research_questions=["RQ1"],
    )
    formatted = ClassificationService.format_classifications(classifications, schema)

    assert formatted[0]["facet_name"] == "venue"
    assert formatted[0]["category"] in ["journal", "conference", "unknown", "Not Applicable"]


def test_resolve_provider_prefers_anthropic(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "keyA")
    monkeypatch.setenv("OPENAI_API_KEY", "keyO")
    monkeypatch.setenv("LLM_PROVIDER", "auto")

    importlib.reload(config_module)
    importlib.reload(lp)

    provider_name, _ = lp.resolve_provider_name()
    assert provider_name == "claude"

    # Clean up
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("LLM_PROVIDER", raising=False)


def test_resolve_provider_small_model(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "keyA")
    monkeypatch.setenv("LLM_PROVIDER", "claude")
    monkeypatch.setenv("CLAUDE_SMALL_MODEL", "claude-small")

    importlib.reload(config_module)
    importlib.reload(lp)

    provider_name, model_name = lp.resolve_provider_name(prefer_small_model=True)
    assert provider_name == "claude"
    assert model_name == "claude-small"

    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("CLAUDE_SMALL_MODEL", raising=False)
