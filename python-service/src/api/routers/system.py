from fastapi import APIRouter, HTTPException

from src.core.llm_provider import available_providers, get_llm_provider, resolve_provider_name

router = APIRouter()


@router.get("/test-llm")
async def test_llm():
    """
    Test LLM provider connection.

    This endpoint tests if the configured LLM provider is accessible.
    """
    try:
        provider_name, model_name = resolve_provider_name()
        get_llm_provider()  # Ensure instantiation works
        return {
            "status": "configured",
            "active_provider": provider_name,
            "model": model_name,
            "available_providers": available_providers(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM provider error: {str(e)}") from e
