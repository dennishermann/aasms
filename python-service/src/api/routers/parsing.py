import logging
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from src.core.llm_provider import get_llm_provider, resolve_provider_name
from src.services.document_parser import DocumentParser
from src.services.extraction.pdf_service import PdfMetadataService
from src.services.extraction.website_service import WebsiteMetadataService

logger = logging.getLogger(__name__)

router = APIRouter()

# Request/Response models


class ParsePdfResponse(BaseModel):
    """Response model for PDF parsing + LLM metadata extraction."""

    title: str
    authors: list[str]
    abstract: str
    publicationDate: str
    venue: str
    doi: str
    content: str | None = None
    content_excerpt: str | None = None
    confidence: float
    pages: int
    metadata: dict[str, Any]


class ParseTextRequest(BaseModel):
    """Request model for text-based metadata extraction."""

    text: str
    url: str | None = None
    title: str | None = None


# Routes


@router.post("/parse-text", response_model=ParsePdfResponse)
async def parse_text(request: ParseTextRequest):
    """
    Extract metadata from raw text (e.g. from a website) using LLM.
    """
    try:
        # Get LLM provider instance (configured with small model preferred)
        llm_provider = get_llm_provider(prefer_small_model=True)
        service = WebsiteMetadataService(llm_provider)

        # Build initial metadata from request hints
        initial_metadata = {}
        if request.title:
            initial_metadata["title"] = request.title

        logger.info(
            "parse-text: start",
            extra={
                "provider": getattr(llm_provider, "model", "generic"),
                "text_length": len(request.text),
                "url": request.url,
            },
        )
        logger.info(f"parse-text: received input text preview: {request.text[:200]}...")

        llm_result = await service.extract_metadata(
            text_content=request.text, url=request.url, title_hint=request.title
        )
        logger.info(f"parse-text: LLM returned: {llm_result}")

        logger.info(
            "parse-text: success",
            extra={
                "title": llm_result.get("title"),
                "authors": llm_result.get("authors"),
            },
        )

        return ParsePdfResponse(
            title=llm_result.get("title", "") or "",
            authors=llm_result.get("authors", []) or [],
            abstract=llm_result.get("abstract", "") or "",
            publicationDate=llm_result.get("publicationDate", "") or "",
            venue=llm_result.get("venue", "") or "",
            doi=llm_result.get("doi", "") or "",
            content=request.text,  # Return full text as content
            content_excerpt=llm_result.get("content_excerpt", "") or request.text[:1000],
            confidence=float(llm_result.get("confidence", 0.0) or 0.0),
            pages=1,  # Dummy value for text sources
            metadata=initial_metadata,
        )

    except Exception as e:
        logger.exception("parse-text: failed")
        raise HTTPException(
            status_code=500, detail=f"Text metadata extraction failed: {str(e)}"
        ) from e


@router.post("/parse-pdf")
async def parse_pdf(
    file: UploadFile = File(...),
    include_content: bool = True,
    max_pages: int = 3,
):
    """
    Parse PDF and extract metadata using a small LLM (first N pages only).
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    try:
        content_bytes = await file.read()
        parsed = await DocumentParser.parse_pdf(
            content_bytes, max_pages=max_pages, return_pdf_excerpt=True
        )
    except Exception as e:
        logger.exception("parse-pdf: failed to read/parse PDF")
        raise HTTPException(status_code=500, detail=f"Failed to read PDF: {str(e)}") from e

    text_excerpt = parsed.get("text", "")
    pages = parsed.get("pages", 0)
    metadata = parsed.get("metadata", {})
    pdf_excerpt_bytes = parsed.get("pdf_excerpt_bytes")

    logger.info(
        "parse-pdf: parsed pdf",
        extra={
            "pages_total": pages,
            "excerpt_len": len(text_excerpt),
            "pdf_excerpt_bytes": len(pdf_excerpt_bytes) if pdf_excerpt_bytes else 0,
            "metadata_title": metadata.get("title"),
        },
    )

    try:
        provider_name, model_name = resolve_provider_name(prefer_small_model=True)
        logger.info(
            "parse-pdf: resolved provider",
            extra={
                "provider": provider_name,
                "model": model_name,
            },
        )

        service = PdfMetadataService(provider_name)
        llm_result = await service.extract_metadata(
            text_excerpt=text_excerpt,
            pdf_bytes=pdf_excerpt_bytes,
            metadata_hint=metadata,
            model_name=model_name,
        )
        logger.info(
            "parse-pdf: llm_result title=%s authors=%s abstract_len=%s venue=%s doi=%s",
            llm_result.get("title"),
            llm_result.get("authors"),
            len(llm_result.get("abstract", "") or ""),
            llm_result.get("venue"),
            llm_result.get("doi"),
        )
    except Exception as e:
        logger.exception("parse-pdf: LLM metadata extraction failed")
        raise HTTPException(
            status_code=500, detail=f"LLM metadata extraction failed: {str(e)}"
        ) from e

    content_payload = text_excerpt if include_content else None

    return ParsePdfResponse(
        title=llm_result.get("title", "") or "",
        authors=llm_result.get("authors", []) or [],
        abstract=llm_result.get("abstract", "") or "",
        publicationDate=llm_result.get("publicationDate", "") or "",
        venue=llm_result.get("venue", "") or "",
        doi=llm_result.get("doi", "") or "",
        content=content_payload,
        content_excerpt=llm_result.get("content_excerpt", ""),
        confidence=float(llm_result.get("confidence", 0.0) or 0.0),
        pages=pages,
        metadata=metadata,
    )
