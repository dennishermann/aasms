
import pytest
import asyncio
import json
from unittest.mock import AsyncMock, patch
from src.services.importers.import_orchestrator import ImportOrchestrator

@pytest.mark.asyncio
async def test_stream_relevance_concurrency():
    """Verify that stream_relevance_checks limits concurrency to 5."""
    
    # Prepare data
    sources = [{"title": f"Source {i}"} for i in range(20)]
    research_questions = ["RQ1"]
    inclusion_criteria = ["IC1"]
    
    # Metrics to track concurrency
    active_calls = 0
    max_concurrent = 0
    lock = asyncio.Lock()
    
    async def mock_evaluate_inclusion(*args, **kwargs):
        nonlocal active_calls, max_concurrent
        async with lock:
            active_calls += 1
            if active_calls > max_concurrent:
                max_concurrent = active_calls
        
        # Simulate LLM latency
        await asyncio.sleep(0.05)
        
        async with lock:
            active_calls -= 1
            
        return {
            "recommendation": True,
            "overall_confidence": 0.85,
            "inclusion_reasoning": "Fits criteria",
            "exclusion_reasoning": "No exclusions",
            "inclusion_criteria": [{"criterion": "IC1", "decision": True}],
            "exclusion_criteria": [],
            "relevance_score": 0.85,
            "context_response_id": None
        }

    # We need to mock where it is used. Since ImportOrchestrator imports it LOCALLY 
    # inside stream_relevance_checks, we patch the source module.
    # Also patch get_llm_provider since it's called locally too.
    with patch('src.services.inclusion_evaluation_service.InclusionEvaluationService') as MockServiceClass:
        mock_instance = MockServiceClass.return_value
        mock_instance.evaluate_inclusion = AsyncMock(side_effect=mock_evaluate_inclusion)
        
        with patch('src.core.llm_provider.get_llm_provider'):
            orchestrator = ImportOrchestrator()
            
            results = []
            async for item in orchestrator.stream_relevance_checks(
                sources, research_questions, inclusion_criteria
            ):
                results.append(json.loads(item))
    
    # Verification
    assert len(results) == 20
    
    # Check that we received "progress" events
    completed_events = [r for r in results if r['type'] == 'progress']
    assert len(completed_events) == 20
    
    print(f"\nMax concurrent calls observed: {max_concurrent}")
    
    # Assert that we respected the semaphore (limit is 5)
    # Note: max_concurrent could be slightly less due to timing, but shouldn't be > 5.
    # Ideally it hits 5 if there are enough tasks.
    assert max_concurrent <= 5
    assert max_concurrent >= 1 # We should have run something
