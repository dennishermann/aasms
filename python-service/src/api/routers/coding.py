"""
Coding endpoints for Open Facet categorization.

Provides LLM-powered endpoints for:
- Suggesting categories from OPEN facet values
- Classifying individual values into categories
"""

import logging
from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter

from src.core.llm_provider import get_llm_provider
from src.services.coding_service import CodingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/coding", tags=["coding"])


# ============ Request/Response Models ============


class SuggestCategoriesRequest(BaseModel):
    """Request to generate category suggestions from OPEN facet values."""
    values: List[str] = Field(..., description="List of unique values extracted from sources")
    facet_name: str = Field(..., description="Name of the facet being coded")
    facet_description: Optional[str] = Field(None, description="Description of what this facet captures")
    min_categories: int = Field(3, ge=2, le=20, description="Minimum number of categories to suggest")
    max_categories: int = Field(10, ge=3, le=30, description="Maximum number of categories to suggest")


class SuggestedCategory(BaseModel):
    """A suggested category with its grouped values."""
    name: str = Field(..., description="Category name")
    description: str = Field(..., description="Description of what this category represents")
    values: List[str] = Field(..., description="Values that belong to this category")
    source_count: int = Field(..., description="Number of sources with values in this category")


class SuggestCategoriesResponse(BaseModel):
    """Response with suggested categories."""
    categories: List[SuggestedCategory]
    uncategorized: List[str] = Field(default_factory=list, description="Values that don't fit any category")
    reasoning: str = Field(..., description="Explanation of the categorization approach")


class ClassifyValueRequest(BaseModel):
    """Request to classify a single value into existing categories."""
    value: str = Field(..., description="The value to classify")
    categories: List[dict] = Field(..., description="Existing categories with id, name, description")
    facet_name: str = Field(..., description="Name of the facet")


class ClassifyValueResponse(BaseModel):
    """Response with classification result."""
    category_id: Optional[str] = Field(None, description="ID of the matched category, or null if uncategorized")
    category_name: Optional[str] = Field(None, description="Name of the matched category")
    confidence: float = Field(..., ge=0, le=1, description="Confidence score for the classification")
    reasoning: str = Field(..., description="Explanation for the classification decision")


class MapKeywordRequest(BaseModel):
    """Request to map a keyword/phrase to categories or propose a new category."""
    keyword: str = Field(..., description="Keyword/phrase to map")
    categories: List[dict] = Field(..., description="Existing categories with id, name, description")
    facet_name: str = Field(..., description="Name of the facet")
    facet_description: Optional[str] = Field(None, description="Facet description")


class MapKeywordResponse(BaseModel):
    """Response with mapping suggestion."""
    category_name: Optional[str] = Field(None, description="Name of the matched category, if any")
    confidence: float = Field(..., ge=0, le=1, description="Confidence score for the suggestion")
    reasoning: str = Field(..., description="Explanation for the mapping decision")
    propose_new: bool = Field(..., description="Whether a new category is proposed")
    proposed_category_name: Optional[str] = Field(None, description="Proposed category name")
    proposed_category_description: Optional[str] = Field(None, description="Proposed category description")


# ============ Endpoints ============


@router.post("/suggest-categories", response_model=SuggestCategoriesResponse)
async def suggest_categories(request: SuggestCategoriesRequest) -> SuggestCategoriesResponse:
    """
    Generate category suggestions from a list of OPEN facet values.
    
    Uses LLM to cluster similar values and suggest meaningful category names.
    """
    # Get LLM provider and create service
    llm_provider = get_llm_provider()
    coding_service = CodingService(llm_provider)
    
    result = await coding_service.suggest_categories(
        values=request.values,
        facet_name=request.facet_name,
        facet_description=request.facet_description,
        min_categories=request.min_categories,
        max_categories=request.max_categories,
    )
    
    # Convert to response model
    categories = [
        SuggestedCategory(
            name=cat["name"],
            description=cat["description"],
            values=cat["values"],
            source_count=cat["source_count"],
        )
        for cat in result.get("categories", [])
    ]
    
    return SuggestCategoriesResponse(
        categories=categories,
        uncategorized=result.get("uncategorized", []),
        reasoning=result.get("reasoning", ""),
    )


@router.post("/classify-value", response_model=ClassifyValueResponse)
async def classify_value(request: ClassifyValueRequest) -> ClassifyValueResponse:
    """
    Classify a single value into one of the existing categories.
    
    Used for auto-categorizing new sources after coding is enabled.
    """
    # Get LLM provider and create service
    llm_provider = get_llm_provider()
    coding_service = CodingService(llm_provider)
    
    result = await coding_service.classify_value(
        value=request.value,
        categories=request.categories,
        facet_name=request.facet_name,
    )
    
    return ClassifyValueResponse(
        category_id=result.get("category_id"),
        category_name=result.get("category_name"),
        confidence=result.get("confidence", 0.0),
        reasoning=result.get("reasoning", ""),
    )


@router.post("/map-keyword", response_model=MapKeywordResponse)
async def map_keyword(request: MapKeywordRequest) -> MapKeywordResponse:
    """
    Map a keyword/phrase to existing categories or propose a new category.
    """
    llm_provider = get_llm_provider()
    coding_service = CodingService(llm_provider)

    result = await coding_service.map_keyword(
        keyword=request.keyword,
        categories=request.categories,
        facet_name=request.facet_name,
        facet_description=request.facet_description,
    )

    return MapKeywordResponse(
        category_name=result.get("category_name"),
        confidence=result.get("confidence", 0.0),
        reasoning=result.get("reasoning", ""),
        propose_new=result.get("propose_new", False),
        proposed_category_name=result.get("proposed_category_name"),
        proposed_category_description=result.get("proposed_category_description"),
    )
