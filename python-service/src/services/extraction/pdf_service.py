"""
Service for extracting metadata from PDF content.
"""

import base64
import json
import logging
from typing import Any

from src.core.schemas.metadata import METADATA_JSON_SCHEMA
from src.services.llm_client import _get_anthropic_client, _get_openai_client, strip_json_fences

logger = logging.getLogger(__name__)


class PdfMetadataService:
    """
    Domain service for extracting metadata from PDFs.
    Handles PDF-specific context (excerpts, file uploads) and prompting.
    """

    def __init__(self, provider_name: str):
        self.provider_name = provider_name

    async def extract_metadata(
        self,
        text_excerpt: str,
        pdf_bytes: bytes | None = None,
        metadata_hint: dict[str, Any] | None = None,
        model_name: str | None = None,
    ) -> dict[str, Any]:
        """
        Extract metadata from PDF excerpt.
        """
        metadata_hint = metadata_hint or {}
        title_hint = metadata_hint.get("title")

        prompt = (
            "You are a research assistant extracting metadata from a PDF excerpt.\n\n"
            "Return ONLY valid JSON with fields: title, authors[], abstract, publicationDate, venue, doi, content_excerpt, confidence, bibtex, isGeneratedSummary.\n"
            "If unknown, use empty string/[] and keep JSON valid. Set isGeneratedSummary to true if abstract is missing and you summarized it.\n\n"
            f"Title Hint: {title_hint}\n"
            f"Text Excerpt Preview:\n{text_excerpt[:1000]}...\n"
        )

        # Determine model
        if not model_name:
            model_name = (
                "gpt-4o-mini" if self.provider_name == "openai" else "claude-3-haiku-20240307"
            )

        try:
            if self.provider_name == "claude":
                return await self._extract_claude(model_name, prompt, pdf_bytes)
            elif self.provider_name == "openai":
                return await self._extract_openai(model_name, prompt, text_excerpt, pdf_bytes)
            else:
                raise ValueError(f"Unsupported provider: {self.provider_name}")

        except Exception as e:
            logger.error(f"PDF extraction failed: {e}")
            raise

    async def _extract_claude(
        self, model_name: str, prompt: str, pdf_bytes: bytes | None
    ) -> dict[str, Any]:
        """Claude implementation using base64 image/document."""
        client = _get_anthropic_client()
        content_parts = []

        if pdf_bytes:
            pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
            content_parts.append(
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": pdf_b64,
                    },
                }
            )

        content_parts.append({"type": "text", "text": prompt})

        msg = await client.messages.create(
            model=model_name,
            messages=[{"role": "user", "content": content_parts}],
            max_tokens=1000,
            temperature=0.1,
        )
        content = msg.content[0].text if msg.content else "{}"
        return json.loads(strip_json_fences(content))

    async def _extract_openai(
        self, model_name: str, prompt: str, text_excerpt: str, pdf_bytes: bytes | None
    ) -> dict[str, Any]:
        """OpenAI implementation using File API or text fallback."""
        client = _get_openai_client()
        file_id = None

        if pdf_bytes:
            # Use purpose="assistants" for PDF compatibility
            uploaded = await client.files.create(
                file=("excerpt.pdf", pdf_bytes), purpose="assistants"
            )
            file_id = uploaded.id

        user_content = [{"type": "input_text", "text": prompt}]

        if file_id:
            user_content.append({"type": "input_file", "file_id": file_id})
        else:
            # Fallback to text excerpt if no PDF bytes provided (shouldn't happen for valid PDF flow but safe to handle)
            user_content[0]["text"] += f"\n\nFull Excerpt:\n{text_excerpt[:20000]}"

        resp = await client.responses.create(
            model=model_name,
            input=[
                {
                    "role": "system",
                    "content": [{"type": "input_text", "text": "You are a research assistant."}],
                },
                {"role": "user", "content": user_content},
            ],
            text={
                "format": {
                    "type": "json_schema",
                    "name": "metadata_extraction",
                    "schema": METADATA_JSON_SCHEMA,
                    "strict": True,
                }
            },
        )

        return json.loads(resp.output_text or "{}")
