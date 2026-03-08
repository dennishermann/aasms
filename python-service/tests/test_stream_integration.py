import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.services.importers.import_orchestrator import ImportOrchestrator


@pytest.mark.asyncio
async def test_stream_integration_real_service():
    """
    Verify ImportOrchestrator -> InclusionEvaluationService pipeline
    works with a mocked LLMProvider (checks for syntax errors/hangs in logic).
    """

    # Prepare data
    sources = [{"title": f"Source {i}", "publication_date": "2023"} for i in range(5)]
    research_questions = ["RQ1"]
    inclusion_criteria = ["IC1"]

    # Mock LLM Provider
    mock_provider = MagicMock()
    mock_provider.model = "gpt-mock"

    # Mock generate_structured_output to return valid dummy data
    async def mock_generate(*args, **kwargs):
        # Simulate slight delay
        await asyncio.sleep(0.01)
        return {
            "decision": True,
            "confidence": 0.9,
            "reasoning": "Mocked reasoning",
            "_response_id": "ctx_123",
        }

    mock_provider.generate_structured_output = AsyncMock(side_effect=mock_generate)

    with (
        patch("src.core.llm_provider.get_llm_provider", return_value=mock_provider),
        patch("src.core.llm_provider.voting_available", return_value=False),
    ):
        orchestrator = ImportOrchestrator()

        results = []
        async for item in orchestrator.stream_relevance_checks(
            sources, research_questions, inclusion_criteria
        ):
            print(f"Got item: {item}")
            results.append(json.loads(item))

    # Each source emits "started" + "progress" events = 10 total
    assert len(results) == 10
    completed_events = [r for r in results if r["type"] == "progress"]
    assert len(completed_events) == 5
