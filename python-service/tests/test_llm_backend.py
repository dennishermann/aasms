import importlib
import pytest

from src.services.llm_analyzer import LLMAnalyzer
from src.services.classification_service import ClassificationService
from src.core import llm_provider as lp
from src.core import config as config_module
from src.core.llm_provider import LLMProvider


class FakeProvider(LLMProvider):
    def __init__(self, decision: bool = True):
        self.decision = decision

    async def generate_completion(self, prompt, system_prompt=None, temperature=0.1, max_tokens=4000):
        return "ok"

    async def generate_structured_output(
        self,
        prompt,
        system_prompt=None,
        response_schema=None,
        temperature=0.1,
        max_tokens=4000,
        previous_response_id=None,
    ):
        # Heuristic to detect classification request vs inclusion
        is_classification = False
        if isinstance(response_schema, dict):
            if "classifications" in response_schema:
                is_classification = True
            elif "properties" in response_schema and "classifications" in response_schema["properties"]:
                is_classification = True
        
        if is_classification:
            return {
                "classifications": [
                    {
                        "facet_name": "venue",
                        "category": "journal",
                        "confidence": 0.8,
                        "reasoning": "looks like a journal",
                    }
                ]
            }
        return {
            "criterion": "sample",
            "decision": self.decision,
            "confidence": 0.9,
            "reasoning": "matches text",
        }


@pytest.mark.asyncio
async def test_evaluate_inclusion_recommendation_changes_with_exclusion():
    source_content = {"title": "Test", "abstract": "Something", "content": "body"}
    analyzer = LLMAnalyzer(FakeProvider(decision=True))

    # Test 1: Inclusion only (Expect True)
    result = await analyzer.inclusion_service.evaluate_inclusion(
        source_content=source_content,
        inclusion_criteria=["C1", "C2"],
        exclusion_criteria=[], # Remove exclusion criteria so decision=True results in Include
        research_questions=["RQ1"],
    )

    assert result["recommendation"] is True

    analyzer_negative = LLMAnalyzer(FakeProvider(decision=True))
    # Test 2: With Exclusion (Expect False because E1 will be 'decided' as True -> Excluded)
    analyzer_negative.llm_provider.decision = True
    result_negative = await analyzer_negative.inclusion_service.evaluate_inclusion(
        source_content=source_content,
        inclusion_criteria=["C1"],
        exclusion_criteria=["E1"],
        research_questions=["RQ1"],
    )
    assert result_negative["recommendation"] is False


@pytest.mark.asyncio
async def test_classification_formatting_handles_list_schema():
    source_content = {"title": "Test", "abstract": "Something", "content": "body"}
    schema = [{"name": "venue", "categories": ["journal", "conference"]}]
    analyzer = LLMAnalyzer(FakeProvider(decision=True))

    classifications = await analyzer.classification_service.classify_source(
        source_content=source_content,
        classification_schema=schema,
        research_questions=["RQ1"],
    )
    formatted = ClassificationService.format_classifications(classifications, schema)

    assert formatted[0]["facet_name"] == "venue"
    assert formatted[0]["category"] in ["journal", "conference", "unknown"]


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

