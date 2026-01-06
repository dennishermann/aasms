"""Document parsing service for extracting text from PDFs and other formats."""

from typing import Dict, Any, Optional
import io

import fitz  # PyMuPDF
import logging

logger = logging.getLogger(__name__)


class DocumentParser:
    """Service for parsing documents and extracting text content."""

    @staticmethod
    async def parse_pdf(
        file_content: bytes,
        max_pages: int | None = None,
        max_chars: int | None = None,
        return_pdf_excerpt: bool = True,
    ) -> Dict[str, Any]:
        """
        Parse PDF file and extract text content.

        Args:
            file_content: PDF file content as bytes
            max_pages: Maximum number of pages to parse (None for all pages)
            max_chars: Maximum characters to extract (None for no limit)
            return_pdf_excerpt: Whether to return PDF excerpt bytes

        Returns:
            Dictionary containing extracted text and metadata

        """
        doc = fitz.open(stream=file_content, filetype="pdf")
        text_parts = []
        
        # Determine page range
        pages_to_parse = len(doc) if max_pages is None else min(max_pages, len(doc))
        
        for page_index in range(pages_to_parse):
            page = doc.load_page(page_index)
            text_parts.append(page.get_text("text"))
            # If max_chars is set, stop early if we've exceeded it
            if max_chars is not None and sum(len(t) for t in text_parts) >= max_chars:
                break

        full_text = "\n".join(text_parts).strip()
        # Truncate if max_chars is set and exceeded
        if max_chars is not None and len(full_text) > max_chars:
            full_text = full_text[:max_chars]

        meta = doc.metadata or {}

        pdf_excerpt_bytes: Optional[bytes] = None
        if return_pdf_excerpt:
            # Write first max_pages pages to an in-memory PDF
            # If max_pages is None, include all pages
            out_buf = io.BytesIO()
            new_doc = fitz.open()
            pages_for_excerpt = len(doc) if max_pages is None else min(max_pages, len(doc))
            for page_index in range(pages_for_excerpt):
                new_doc.insert_pdf(doc, from_page=page_index, to_page=page_index)
            new_doc.save(out_buf)
            pdf_excerpt_bytes = out_buf.getvalue()
            new_doc.close()

        result = {
            "text": full_text,
            "pages": len(doc),
            "metadata": {
                "title": meta.get("title") or meta.get("Title"),
                "author": meta.get("author") or meta.get("Author"),
                "producer": meta.get("producer") or meta.get("Producer"),
                "creationDate": meta.get("creationDate") or meta.get("CreationDate"),
                "modDate": meta.get("modDate") or meta.get("ModDate"),
                "raw": meta,
            },
            "pdf_excerpt_bytes": pdf_excerpt_bytes,
        }
        logger.info(
            "document_parser.parse_pdf",
            extra={
                "pages_total": len(doc),
                "excerpt_pages": pages_to_parse,
                "excerpt_len": len(full_text),
                "pdf_excerpt_bytes": len(pdf_excerpt_bytes) if pdf_excerpt_bytes else 0,
                "meta_title": result["metadata"]["title"],
            },
        )
        return result

    @staticmethod
    async def parse_webpage(html_content: str, url: str) -> Dict[str, Any]:
        """
        Parse webpage HTML and extract main content.

        Args:
            html_content: HTML content as string
            url: Original URL for context

        Returns:
            Dictionary containing extracted content and metadata

        Status: Stub - Full implementation in step 5
        """
        # TODO: Implement webpage parsing using BeautifulSoup
        # 1. Parse HTML with BeautifulSoup
        # 2. Extract main text content
        # 3. Extract metadata (title, author, date)
        # 4. Clean and structure text
        # 5. Return structured data

        raise NotImplementedError("Webpage parsing not yet implemented")

