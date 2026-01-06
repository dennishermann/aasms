
import pytest
import asyncio
import json
from unittest.mock import AsyncMock, patch, MagicMock
from src.services.importers.import_orchestrator import ImportOrchestrator
from src.services.inclusion_evaluation_service import InclusionEvaluationService

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
            "_response_id": "ctx_123"
        }
    
    mock_provider.generate_structured_output = AsyncMock(side_effect=mock_generate)

    with patch('src.core.llm_provider.get_llm_provider', return_value=mock_provider):
        # Also patch in inclusion_evaluation_service if it imports it separately?
        # No, get_llm_provider is imported in import_orchestrator and passed to service constructor.
        # Wait, ImportOrchestrator imports get_llm_provider LOCALLY inside stream_relevance_checks.
        # So checking the patch target above... 
        # src.services.importers.import_orchestrator.get_llm_provider is correct if it uses 'from ... import get_llm_provider'
        
        # However, InclusionEvaluationService (real) calls await self.llm_provider.generate_structured_output
        
        orchestrator = ImportOrchestrator()
        
        results = []
        async for item in orchestrator.stream_relevance_checks(
            sources, research_questions, inclusion_criteria
        ):
            print(f"Got item: {item}")
            results.append(json.loads(item))
            
    assert len(results) == 5
    print("Integration test finished successfully.")
