"""Service for generating LLM-powered research question summaries."""

import asyncio
import logging
from typing import Any

from src.core.llm_provider import LLMProvider

logger = logging.getLogger(__name__)

RESPONSE_SCHEMA = {
    "summary": "string",
    "key_findings": ["string"],
    "evidence_quality": "string",
    "gaps": ["string"],
}


class RQSummaryService:
    """Generates narrative summaries for research questions using classification data."""

    def __init__(self, llm_provider: LLMProvider):
        self.llm_provider = llm_provider

    async def generate_summary(
        self,
        question: str,
        facet_data: list[dict[str, Any]],
        source_evidence: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Generate a narrative summary for a single research question.

        Args:
            question: The research question text.
            facet_data: List of facets linked to this RQ with category distributions.
            source_evidence: List of source excerpts with their classifications.

        Returns:
            Dict with summary, key_findings, evidence_quality, gaps.
        """
        prompt = self._build_prompt(question, facet_data, source_evidence)

        result = await self.llm_provider.generate_structured_output(
            prompt=prompt,
            system_prompt=(
                "You are an academic research assistant helping synthesize findings "
                "from a systematic mapping study. Provide evidence-based, concise answers "
                "to research questions based on the classification data and source evidence provided."
            ),
            response_schema=RESPONSE_SCHEMA,
            max_tokens=2000,
        )

        # Validate and normalize
        return {
            "summary": result.get("summary", ""),
            "key_findings": result.get("key_findings", []),
            "evidence_quality": result.get("evidence_quality", "limited"),
            "gaps": result.get("gaps", []),
        }

    async def generate_all_summaries(
        self,
        research_questions: list[dict[str, Any]],
        all_facet_data: list[dict[str, Any]],
        source_evidence: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Generate summaries for all research questions.

        Args:
            research_questions: List of {id, question} dicts.
            all_facet_data: All facets with category distributions and rq links.
            source_evidence: Source excerpts with classifications.

        Returns:
            List of summary dicts, one per RQ.
        """
        tasks = []
        for rq in research_questions:
            # Filter facets linked to this RQ
            rq_facets = [
                f for f in all_facet_data if rq["id"] in f.get("research_question_ids", [])
            ]
            tasks.append(self.generate_summary(rq["question"], rq_facets, source_evidence))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        summaries = []
        for rq, result in zip(research_questions, results):
            if isinstance(result, Exception):
                logger.error("rq-summary: failed for RQ %s: %s", rq["id"], result)
                summaries.append(
                    {
                        "rq_id": rq["id"],
                        "question": rq["question"],
                        "summary": "Failed to generate summary. Please try again.",
                        "key_findings": [],
                        "evidence_quality": "limited",
                        "gaps": [],
                    }
                )
            else:
                summaries.append(
                    {
                        "rq_id": rq["id"],
                        "question": rq["question"],
                        **result,
                    }
                )

        return summaries

    def _build_prompt(
        self,
        question: str,
        facet_data: list[dict[str, Any]],
        source_evidence: list[dict[str, Any]],
    ) -> str:
        """Build the LLM prompt for a single RQ summary."""
        sections = [f'Research Question: "{question}"', ""]

        # Add facet distribution data
        if facet_data:
            sections.append("=== Classification Data ===")
            for facet in facet_data:
                sections.append(f"\nFacet: {facet['name']} (type: {facet['type']})")
                categories = facet.get("categories", [])
                if categories:
                    for cat in categories:
                        sections.append(
                            f"  - {cat['name']}: {cat['count']} sources ({cat['percentage']:.0f}%)"
                        )
                else:
                    sections.append("  (no categories)")
            sections.append("")

        # Add source evidence
        if source_evidence:
            sections.append(f"=== Source Evidence ({len(source_evidence)} included sources) ===")
            for i, source in enumerate(source_evidence[:20], 1):
                sections.append(f"\n[{i}] {source.get('title', 'Untitled')}")
                abstract = source.get("abstract", "")
                if abstract:
                    sections.append(f"    Abstract: {abstract[:300]}...")
                classifications = source.get("classifications", {})
                if classifications:
                    class_str = ", ".join(f"{k}: {v}" for k, v in classifications.items())
                    sections.append(f"    Classifications: {class_str}")
            sections.append("")

        sections.append("=== Instructions ===")
        sections.append(
            "Based on the classification data and source evidence above, provide a comprehensive "
            "answer to the research question. Your response must include:"
        )
        sections.append('1. "summary": A narrative paragraph answering the research question')
        sections.append('2. "key_findings": 3-5 bullet points of the most important findings')
        sections.append(
            '3. "evidence_quality": One of "strong" (many sources, consistent data), '
            '"moderate" (some sources, partial data), or "limited" (few sources, sparse data)'
        )
        sections.append(
            '4. "gaps": Areas where more research is needed based on the data'
        )

        return "\n".join(sections)
