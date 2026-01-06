from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from pydantic.config import ConfigDict
from uuid import uuid4
import logging
import json
from src.core.llm_provider import get_llm_provider
from src.services.classification_service import ClassificationService
from src.services.inclusion_evaluation_service import InclusionEvaluationService
from src.services.document_parser import DocumentParser

logger = logging.getLogger(__name__)

router = APIRouter()

# Request/Response models

class ClassificationResult(BaseModel):
    """Classification result for a single facet."""
    model_config = ConfigDict(populate_by_name=True)

    facet_name: str = Field(alias="facetName")
    category: str
    confidence: float
    reasoning: Optional[str] = None
    is_manual_override: Optional[bool] = Field(default=False, alias="isManualOverride")


class CriterionEvaluation(BaseModel):
    """Evaluation result for a single criterion."""
    model_config = ConfigDict(populate_by_name=True)

    criterion: str
    decision: bool
    reasoning: str
    confidence: float


class ClassificationResponse(BaseModel):
    """Response model for classification-only invocation."""
    model_config = ConfigDict(populate_by_name=True)
    classifications: List[ClassificationResult]


class ClassificationTextRequest(BaseModel):
    """Request model for text-based classification."""
    model_config = ConfigDict(populate_by_name=True)

    source_id: Optional[str] = Field(default=None, alias="sourceId")
    study_parameters: Dict[str, Any] = Field(alias="studyParameters")
    source_content: Dict[str, Any] = Field(alias="sourceContent")
    previous_response_id: Optional[str] = Field(default=None, alias="classificationThreadId")


class InclusionAnalysisResponse(BaseModel):
    """Response model for inclusion/exclusion-only analysis."""
    model_config = ConfigDict(populate_by_name=True)

    analysis_id: str
    recommendation: str  # "include" or "exclude"
    inclusion_reasoning: str = Field(alias="inclusionReasoning")
    exclusion_reasoning: str = Field(alias="exclusionReasoning")
    confidence: float
    inclusion_criteria: List[CriterionEvaluation] = Field(alias="inclusionCriteria")
    exclusion_criteria: List[CriterionEvaluation] = Field(alias="exclusionCriteria")
    relevance_score: Optional[float] = Field(default=None, alias="relevanceScore")
    quality_notes: Optional[str] = Field(default=None, alias="qualityNotes")
    context_response_id: Optional[str] = Field(default=None, alias="contextResponseId")


class InclusionAnalysisTextRequest(BaseModel):
    """Request model for text-based inclusion analysis."""
    model_config = ConfigDict(populate_by_name=True)

    source_id: Optional[str] = Field(default=None, alias="sourceId")
    study_parameters: Dict[str, Any] = Field(alias="studyParameters")
    source_content: Dict[str, Any] = Field(alias="sourceContent")
    previous_response_id: Optional[str] = Field(default=None, alias="classificationThreadId")


class FullAnalysisResponse(BaseModel):
    """Response model for combined analysis."""
    model_config = ConfigDict(populate_by_name=True)
    
    recommendation: str
    inclusion_reasoning: str = Field(alias="inclusionReasoning")
    exclusion_reasoning: str = Field(alias="exclusionReasoning")
    confidence: float
    inclusion_criteria: List[CriterionEvaluation] = Field(alias="inclusionCriteria")
    exclusion_criteria: List[CriterionEvaluation] = Field(alias="exclusionCriteria")
    classifications: Optional[List[ClassificationResult]] = None


# Helpers

async def _run_classification(
    source_id: Optional[str],
    study_params: Dict[str, Any],
    source_content: Dict[str, Any],
    previous_response_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Shared logic for classification."""
    try:
        provider = get_llm_provider()
        classifier = ClassificationService(provider)
    except Exception as e:
        logger.exception("classify: provider init failed")
        raise HTTPException(status_code=500, detail=f"LLM provider error: {str(e)}")

    research_questions = (
        study_params.get("research_questions")
        or study_params.get("researchQuestions")
        or []
    )
    classification_schema = (
        study_params.get("classification_schema")
        or study_params.get("classificationSchema")
        or {}
    )

    try:
        ClassificationService.validate_classification_schema(classification_schema)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid classification schema: {str(e)}")

    try:
        logger.info(
            "classify: start",
            extra={
                "source_id": source_id,
                "rq_count": len(research_questions),
                "has_class_schema": bool(classification_schema),
                "has_publication_date": bool(source_content.get("publication_date")),
                "content_excerpt_length": len(source_content.get("content_excerpt") or ""),
                "previous_response_id": previous_response_id,
            },
        )
        classifications = await classifier.classify_source(
            source_content=source_content,
            classification_schema=classification_schema,
            research_questions=research_questions,
            previous_response_id=previous_response_id,
        )
        logger.info(
            "classify: done",
            extra={
                "source_id": source_id,
                "class_count": len(classifications or []),
            },
        )
        return classifications
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("classify: failed")
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")


async def _run_inclusion_analysis(
    source_id: Optional[str],
    study_params: Dict[str, Any],
    source_content: Dict[str, Any],
    previous_response_id: Optional[str] = None,
) -> InclusionAnalysisResponse:
    """Shared logic for inclusion analysis."""
    try:
        provider = get_llm_provider()
        inclusion_service = InclusionEvaluationService(provider)
    except Exception as e:
        logger.exception("analyze-inclusion: provider init failed")
        raise HTTPException(status_code=500, detail=f"LLM provider error: {str(e)}")

    research_questions = (
        study_params.get("research_questions")
        or study_params.get("researchQuestions")
        or []
    )
    inclusion_criteria = (
        study_params.get("inclusion_criteria")
        or study_params.get("inclusionCriteria")
        or []
    )
    exclusion_criteria = (
        study_params.get("exclusion_criteria")
        or study_params.get("exclusionCriteria")
        or []
    )

    try:
        logger.info(
            "analyze-inclusion: request received",
            extra={
                "source_id": source_id,
                "research_questions_count": len(research_questions),
                "inclusion_criteria_count": len(inclusion_criteria),
                "exclusion_criteria_count": len(exclusion_criteria),
                "title": (source_content.get("title") or "")[:120],
                "abstract_length": len(source_content.get("abstract") or ""),
                "has_content_excerpt": bool(source_content.get("content_excerpt")),
                "content_excerpt_length": len(source_content.get("content_excerpt") or ""),
                "previous_response_id": previous_response_id,
            },
        )
        inclusion_results = await inclusion_service.evaluate_inclusion(
            source_content=source_content,
            inclusion_criteria=inclusion_criteria,
            exclusion_criteria=exclusion_criteria,
            research_questions=research_questions,
            previous_response_id=previous_response_id,
        )
        logger.info(
            "analyze-inclusion: analysis complete",
            extra={
                "source_id": source_id,
                "recommendation": "include" if inclusion_results.get("recommendation") else "exclude",
                "confidence": round(inclusion_results.get("overall_confidence", 0.5), 3),
                "inclusion_criteria_count": len(inclusion_results.get("inclusion_criteria", []) or []),
                "exclusion_criteria_count": len(inclusion_results.get("exclusion_criteria", []) or []),
            },
        )
    except Exception as e:
        logger.exception("analyze-inclusion: failed")
        raise HTTPException(status_code=500, detail=f"Inclusion analysis failed: {str(e)}")

    # Transform decision -> fulfilled for frontend compatibility
    inclusion_criteria_transformed = []
    for c in inclusion_results.get("inclusion_criteria", []):
        criterion_data = {
            "criterion": c.get("criterion", ""),
            "decision": c.get("decision", False),
            "reasoning": c.get("reasoning", ""),
            "confidence": c.get("confidence", 0.5),
        }
        inclusion_criteria_transformed.append(CriterionEvaluation(**criterion_data))
    
    exclusion_criteria_transformed = []
    for c in inclusion_results.get("exclusion_criteria", []):
        criterion_data = {
            "criterion": c.get("criterion", ""),
            "decision": c.get("decision", False),
            "reasoning": c.get("reasoning", ""),
            "confidence": c.get("confidence", 0.5),
        }
        exclusion_criteria_transformed.append(CriterionEvaluation(**criterion_data))

    response = InclusionAnalysisResponse(
        analysis_id=str(uuid4()),
        recommendation="include" if inclusion_results.get("recommendation") else "exclude",
        inclusion_reasoning=inclusion_results.get("inclusion_reasoning", ""),
        exclusion_reasoning=inclusion_results.get("exclusion_reasoning", ""),
        confidence=float(inclusion_results.get("overall_confidence", 0.5)),
        inclusion_criteria=inclusion_criteria_transformed,
        exclusion_criteria=exclusion_criteria_transformed,
        relevance_score=inclusion_results.get("relevance_score"),
        quality_notes=inclusion_results.get("quality_notes", "Automatically generated."),
        context_response_id=inclusion_results.get("context_response_id"),
    )
    
    logger.info(
        "analyze-inclusion: response",
        extra={
            "source_id": source_id,
            "recommendation": response.recommendation,
            "confidence": response.confidence,
            "incl_count": len(response.inclusion_criteria),
            "excl_count": len(response.exclusion_criteria),
        },
    )
    
    return response


# Routes

@router.post("/classify/file", response_model=ClassificationResponse, response_model_by_alias=True)
async def classify_source_file(
    payload: str = Form(...),
    file: UploadFile = File(...),
):
    """Classify a research source from a PDF file."""
    # Parse payload JSON
    try:
        payload_data = json.loads(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload JSON: {str(e)}")

    source_id = payload_data.get("sourceId")
    study_params = payload_data.get("studyParameters") or {}
    source_content_ext = payload_data.get("sourceContent") or {}
    
    # Build source content
    source_content = {
        "title": source_content_ext.get("title") or "",
        "authors": source_content_ext.get("authors") or [],
        "abstract": source_content_ext.get("abstract") or "",
        "venue": source_content_ext.get("venue") or "",
        "doi": source_content_ext.get("doi") or "",
        "publication_date": source_content_ext.get("publication_date") or "",
        "content_excerpt": source_content_ext.get("content_excerpt") or "",
    }

    # Parse PDF (Required for this endpoint)
    if not file.filename.lower().endswith(".pdf"):
         raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        pdf_bytes = await file.read()
        if not pdf_bytes:
            raise HTTPException(status_code=400, detail="Empty PDF file uploaded")

        parsed = await DocumentParser.parse_pdf(
            pdf_bytes, max_pages=50, max_chars=100000, return_pdf_excerpt=False
        )
        text_content = parsed.get("text", "")
        if text_content:
            source_content["content_excerpt"] = text_content
            
        logger.info(
            "classify/file: PDF parsed",
            extra={
                "source_id": source_id,
                "pages": parsed.get("pages", 0),
                "text_length": len(text_content),
            },
        )
    except Exception as e:
        logger.exception("classify/file: PDF parsing failed")
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {str(e)}")

    classifications = await _run_classification(source_id, study_params, source_content, None)
    return ClassificationResponse(classifications=[ClassificationResult(**c) for c in classifications])


@router.post("/classify/text", response_model=ClassificationResponse, response_model_by_alias=True)
async def classify_source_text(request: ClassificationTextRequest):
    """Classify a research source from text content."""
    source_content = {
        "title": request.source_content.get("title") or "",
        "authors": request.source_content.get("authors") or [],
        "abstract": request.source_content.get("abstract") or "",
        "venue": request.source_content.get("venue") or "",
        "doi": request.source_content.get("doi") or "",
        "publication_date": request.source_content.get("publication_date") or "",
        "content_excerpt": request.source_content.get("content_excerpt") or "",
    }
    
    classifications = await _run_classification(
        request.source_id, 
        request.study_parameters, 
        source_content, 
        request.previous_response_id
    )
    return ClassificationResponse(classifications=[ClassificationResult(**c) for c in classifications])


@router.post("/analyze-inclusion/file", response_model=InclusionAnalysisResponse, response_model_by_alias=True)
async def analyze_inclusion_file(
    payload: str = Form(...),
    file: UploadFile = File(...),
):
    """Analyze a research source from a PDF file."""
    try:
        payload_data = json.loads(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload JSON: {str(e)}")

    source_id = payload_data.get("source_id")
    study_params = payload_data.get("study_parameters") or {}
    source_content_ext = payload_data.get("source_content") or {}

    source_content = {
        "title": source_content_ext.get("title") or "",
        "authors": source_content_ext.get("authors") or [],
        "abstract": source_content_ext.get("abstract") or "",
        "venue": source_content_ext.get("venue") or "",
        "doi": source_content_ext.get("doi") or "",
        "content_excerpt": source_content_ext.get("content_excerpt") or "",
    }

    if not file.filename.lower().endswith(".pdf"):
         raise HTTPException(status_code=400, detail="File must be a PDF")

    try:
        pdf_bytes = await file.read()
        if not pdf_bytes:
            raise HTTPException(status_code=400, detail="Empty PDF file uploaded")

        parsed = await DocumentParser.parse_pdf(
            pdf_bytes, max_pages=50, max_chars=100000, return_pdf_excerpt=False
        )
        text_content = parsed.get("text", "")
        if text_content:
            source_content["content_excerpt"] = text_content
        logger.info(
            "analyze-inclusion/file: PDF parsed",
            extra={"source_id": source_id, "pages": parsed.get("pages", 0)}
        )
    except Exception as e:
        logger.exception("analyze-inclusion/file: PDF parsing failed")
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {str(e)}")

    return await _run_inclusion_analysis(source_id, study_params, source_content, None)


@router.post("/analyze-inclusion/text", response_model=InclusionAnalysisResponse, response_model_by_alias=True)
async def analyze_inclusion_text(request: InclusionAnalysisTextRequest):
    """Analyze a research source from text content."""
    source_content = {
        "title": request.source_content.get("title") or "",
        "authors": request.source_content.get("authors") or [],
        "abstract": request.source_content.get("abstract") or "",
        "venue": request.source_content.get("venue") or "",
        "doi": request.source_content.get("doi") or "",
        "content_excerpt": request.source_content.get("content_excerpt") or "",
    }
    
    return await _run_inclusion_analysis(
        request.source_id, 
        request.study_parameters, 
        source_content, 
        request.previous_response_id
    )


@router.post("/analyze-existing-source-pdf", response_model=FullAnalysisResponse, response_model_by_alias=True)
async def analyze_existing_source_pdf(
    payload: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Unified endpoint to parse PDF and run Inclusion + Classification for an existing source.
    """
    try:
        payload_data = json.loads(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload JSON: {str(e)}")

    source_id = payload_data.get("sourceId")
    study_params = payload_data.get("studyParameters") or {}
    source_content_ext = payload_data.get("sourceContent") or {}
    skip_inclusion = payload_data.get("skipInclusion", False)

    # Build base content from request (metadata usually already exists)
    source_content = {
        "title": source_content_ext.get("title") or "",
        "authors": source_content_ext.get("authors") or [],
        "abstract": source_content_ext.get("abstract") or "",
        "venue": source_content_ext.get("venue") or "",
        "doi": source_content_ext.get("doi") or "",
        "publication_date": source_content_ext.get("publication_date") or "",
        "content_excerpt": "", # Will be filled by PDF
    }

    if not file.filename.lower().endswith(".pdf"):
         raise HTTPException(status_code=400, detail="File must be a PDF")

    # 1. Parse PDF
    try:
        pdf_bytes = await file.read()
        parsed = await DocumentParser.parse_pdf(
            pdf_bytes, max_pages=50, max_chars=100000, return_pdf_excerpt=False
        )
        text_content = parsed.get("text", "")
        if text_content:
            source_content["content_excerpt"] = text_content
            
        logger.info(
            "analyze-existing-source-pdf: PDF parsed",
            extra={"source_id": source_id, "pages": parsed.get("pages", 0)}
        )
    except Exception as e:
        logger.exception("analyze-existing-source-pdf: PDF parsing failed")
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {str(e)}")

    # 2. Run Inclusion Analysis (unless skipped)
    if skip_inclusion:
        # Create a dummy "Include" response
        inclusion_response = InclusionAnalysisResponse(
            analysis_id="skipped",
            recommendation="include",
            inclusion_reasoning="Skipped (Already included)",
            exclusion_reasoning="",
            confidence=1.0,
            inclusion_criteria=[],
            exclusion_criteria=[],
        )
    else:
        inclusion_response = await _run_inclusion_analysis(source_id, study_params, source_content, None)
    
    # 3. If included, Run Classification
    classifications = []
    if inclusion_response.recommendation == "include":
        try:
            classifications_raw = await _run_classification(source_id, study_params, source_content, None)
            classifications = [ClassificationResult(**c) for c in classifications_raw]
        except Exception as e:
            logger.error(f"Classification failed after inclusion info: {e}")
            # We don't fail the whole request, just return empty classifications
            pass

    return FullAnalysisResponse(
        recommendation=inclusion_response.recommendation,
        inclusion_reasoning=inclusion_response.inclusion_reasoning,
        exclusion_reasoning=inclusion_response.exclusion_reasoning,
        confidence=inclusion_response.confidence,
        inclusion_criteria=inclusion_response.inclusion_criteria,
        exclusion_criteria=inclusion_response.exclusion_criteria,
        classifications=classifications if inclusion_response.recommendation == "include" else None
    )
