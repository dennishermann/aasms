from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import logging
import json
from src.services.importers.import_orchestrator import ImportOrchestrator
from src.services.importers.import_orchestrator import ImportOrchestrator

logger = logging.getLogger(__name__)

router = APIRouter()

# Request/Response models

class ImportParseRequest(BaseModel):
    """Request to parse an import file without analysis."""
    database_source: str


class ParsedSourceResult(BaseModel):
    """A single parsed source from an import file."""
    title: str
    authors: List[str]
    year: Optional[int] = None
    venue: Optional[str] = None
    doi: Optional[str] = None
    abstract: Optional[str] = None
    url: Optional[str] = None
    publication_date: Optional[str] = None # Added field
    database_specific: Optional[Dict[str, Any]] = None
    bibtex: Optional[str] = None
    raw_entry: Optional[str] = None


class CheckRelevanceRequest(BaseModel):
    """Request to check relevance for a single source."""
    source: ParsedSourceResult
    research_questions: List[str]
    inclusion_criteria: List[str]
    exclusion_criteria: List[str] = []


class RelevanceCheckResult(BaseModel):
    """Relevance check result."""
    is_relevant: bool
    confidence: float
    reasoning: str
    inclusion_criteria: List[Dict[str, Any]] = []
    exclusion_criteria: List[Dict[str, Any]] = []


class ProcessBatchStreamRequest(BaseModel):
    """Request to process a batch of parsed sources via stream."""
    sources: List[ParsedSourceResult]
    research_questions: List[str]
    inclusion_criteria: List[str]
    exclusion_criteria: List[str] = []


# Routes

@router.post("/import/parse", response_model=List[ParsedSourceResult])
async def parse_import_file(
    database_source: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Parse a citation export file and return the raw list of sources.
    Does NOT check for duplicates or relevance.
    """
    orchestrator = ImportOrchestrator()
    try:
        importer = orchestrator.get_importer(database_source)
        file_content = await file.read()
        
        parsed_sources = await importer.parse(file_content, file.filename)
        
        # Convert to Pydantic models
        results = []
        for s in parsed_sources:
            # Map BaseImporter.ParsedSource to pydantic
            
            res = ParsedSourceResult(
                title=s.title,
                authors=s.authors,
                abstract=s.abstract,
                doi=s.doi,
                url=s.url,
                venue=s.venue,
                publication_date=s.publication_date,
                bibtex=s.bibtex,
                database_specific=s.database_specific,
                year=int(s.publication_date) if s.publication_date and s.publication_date.isdigit() and len(s.publication_date) == 4 else None
            )
            results.append(res)
            
        return results
    except ValueError as e:
         raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("parse-import: failed")
        raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)}")


@router.post("/import/check-relevance", response_model=RelevanceCheckResult)
async def check_single_relevance(request: CheckRelevanceRequest):
    """
    Check relevance for a single parsed source using LLM.
    """
    try:
        from src.services.inclusion_evaluation_service import InclusionEvaluationService
        from src.core.llm_provider import get_llm_provider
        
        provider = get_llm_provider(prefer_small_model=True)
        checker = InclusionEvaluationService(provider)
        
        # Ensure 'publication_date' is set on the object passed to checker.
        src = request.source
        if not src.publication_date and src.year:
            src.publication_date = str(src.year)
            
        source_content = {
            "title": src.title,
            "abstract": src.abstract,
            "venue": src.venue,
            "publication_date": src.publication_date,
            "content_excerpt": "", 
        }

        # Adapt criteria format for InclusionEvaluationService
        res = await checker.evaluate_inclusion(
            source_content=source_content,
            inclusion_criteria=[{'criterion': c} for c in request.inclusion_criteria],
            exclusion_criteria=[{'criterion': c} for c in (request.exclusion_criteria or [])],
            research_questions=request.research_questions
        )

        
        return RelevanceCheckResult(
            is_relevant=res['recommendation'],
            confidence=res['overall_confidence'],
            reasoning=(res.get('inclusion_reasoning', '') + " " + res.get('exclusion_reasoning', '')).strip(),
            inclusion_criteria=res['inclusion_criteria'],
            exclusion_criteria=res['exclusion_criteria']
        )
    except Exception as e:
        logger.exception("check-relevance: failed")
        raise HTTPException(status_code=500, detail=f"Relevance check failed: {str(e)}")


@router.post("/process-import")
async def process_import(
    file: UploadFile = File(...),
    database_source: str = Form(...),
    study_parameters: str = Form(...),
    existing_sources: str = Form(...),
    skip_relevance_check: bool = Form(False),
):
    """
    Process a bulk import file and return parsed/analyzed results.
    
    This endpoint does NOT create database records - it only parses and analyzes.
    The Next.js API will handle database operations.
    
    Args:
        file: The CSV or BibTeX file to import
        database_source: User-selected database ("IEEE", "ACM", or "SCOPUS")
        study_parameters: JSON string with research questions and criteria
        existing_sources: JSON string with existing sources for duplicate detection
    """
    from src.services.importers.import_orchestrator import ImportOrchestrator
    
    try:
        study_params = json.loads(study_parameters)
        existing = json.loads(existing_sources)
        
        file_content = await file.read()
        
        logger.info(
            "process-import: request received",
            extra={
                "database_source": database_source,
                "file_name": file.filename,
                "file_size": len(file_content),
                "existing_sources_count": len(existing),
            }
        )
        
        orchestrator = ImportOrchestrator()
        result = await orchestrator.process_import(
            file_content=file_content,
            filename=file.filename,
            database_source=database_source,
            existing_sources=existing,
            research_questions=study_params.get('research_questions', []),
            inclusion_criteria=study_params.get('inclusion_criteria', []),
            exclusion_criteria=study_params.get('exclusion_criteria', []), # Pass exclusion criteria
            skip_relevance_check=skip_relevance_check,
        )
        
        # Convert to JSON-serializable format
        response = {
            'database_source': result['database_source'],
            'total_records': len(result['parsed_sources']),
            'duplicates_count': len(result['duplicates']),
            'new_sources_count': len(result['new_sources']),
            'parsed_sources': [s.dict() for s in result['parsed_sources']],
            'duplicates': [
                {
                    'source': s.dict(),
                    'existing_id': eid,
                    'match_method': method
                }
                for s, eid, method in result['duplicates']
            ],
            'new_sources': [
                {
                    **s.dict(),
                    'relevance': {
                        'is_relevant': result['relevance_results'][idx][0],
                        'confidence': result['relevance_results'][idx][1],
                        'reasoning': result['relevance_results'][idx][2],
                    } if not skip_relevance_check and idx in result['relevance_results'] else None
                }
                for idx, s in enumerate(result['new_sources'])
            ]
        }
        
        logger.info(
            "process-import: success",
            extra={
                "database_source": database_source,
                "total_records": response['total_records'],
                "duplicates": response['duplicates_count'],
                "new_sources": response['new_sources_count'],
            }
        )
        
        return response
        
    except ValueError as e:
        logger.warning(f"process-import: validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("process-import: failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import/process-batch-stream")
async def process_batch_stream(request: ProcessBatchStreamRequest):
    """
    Stream relevance checks for a batch of sources.
    Returns a stream of NDJSON events.
    """
    orchestrator = ImportOrchestrator()
    
    return StreamingResponse(
        orchestrator.stream_relevance_checks(
            new_sources=request.sources,
            research_questions=request.research_questions,
            inclusion_criteria=request.inclusion_criteria,
            exclusion_criteria=request.exclusion_criteria
        ),
        media_type="application/x-ndjson"
    )
