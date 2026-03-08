"""Import orchestrator for bulk database imports."""

import asyncio
import json
import logging
from typing import Any

from .acm_importer import ACMImporter
from .base_importer import BaseImporter
from .duplicate_detector import DuplicateDetector
from .ieee_importer import IEEEImporter
from .scopus_importer import ScopusImporter

logger = logging.getLogger(__name__)


class ImportOrchestrator:
    """Orchestrates the bulk import process."""

    def __init__(self):
        self.importers: dict[str, BaseImporter] = {
            "IEEE": IEEEImporter(),
            "ACM": ACMImporter(),
            "SCOPUS": ScopusImporter(),
        }

    def get_importer(self, database_source: str) -> BaseImporter:
        """Get the importer for the specified database."""
        importer = self.importers.get(database_source)
        if not importer:
            raise ValueError(
                f"Unsupported database source: {database_source}. Supported: IEEE, ACM, SCOPUS"
            )
        return importer

    async def process_import(
        self,
        file_content: bytes,
        filename: str,
        database_source: str,
        existing_sources: list[dict],
        research_questions: list[str],
        inclusion_criteria: list[str],
        exclusion_criteria: list[str] = None,  # Added exclusion criteria
        skip_relevance_check: bool = False,
    ) -> dict[str, Any]:
        """
        Process a bulk import file.
        """
        logger.info(
            "import_orchestrator: starting import",
            extra={
                "database_source": database_source,
                "filename": filename,
                "existing_sources_count": len(existing_sources),
            },
        )

        # Step 1: Get importer for user-selected database
        importer = self.get_importer(database_source)

        # Step 2: Validate that file format matches selected database
        if not importer.can_handle(file_content, filename):
            raise ValueError(
                f"File does not appear to be a {database_source} export. "
                f"Please verify you selected the correct database source."
            )

        # Step 3: Parse file
        logger.info("import_orchestrator: parsing file")
        parsed_sources = await importer.parse(file_content, filename)
        logger.info("import_orchestrator: parsed", extra={"parsed_count": len(parsed_sources)})

        # Step 4: Detect duplicates
        logger.info("import_orchestrator: checking duplicates")
        detector = DuplicateDetector(existing_sources)
        duplicates = []
        new_sources = []

        for source in parsed_sources:
            duplicate = detector.find_duplicate(source)
            if duplicate:
                duplicates.append((source, duplicate[0], duplicate[1]))
            else:
                new_sources.append(source)

        logger.info(
            "import_orchestrator: duplicate check complete",
            extra={
                "duplicates_count": len(duplicates),
                "new_sources_count": len(new_sources),
            },
        )

        # Step 5: Check relevance for new sources only
        relevance_results = {}

        if not skip_relevance_check:
            logger.info("import_orchestrator: checking relevance with parallel LLM calls")

            # Use unified InclusionEvaluationService
            from src.core.llm_provider import get_llm_provider
            from src.services.inclusion_evaluation_service import InclusionEvaluationService

            provider = get_llm_provider(prefer_small_model=True)
            checker = InclusionEvaluationService(provider)

            # Optimize with asyncio.gather to run checks in parallel
            # To avoid rate limits, we process in chunks
            import asyncio

            batch_size = 5  # Small batch size to avoid overwhelming small local LLMs or rate limits

            for i in range(0, len(new_sources), batch_size):
                batch = new_sources[i : i + batch_size]
                logger.info(
                    f"import_orchestrator: processing batch {i // batch_size + 1}, items {i} to {i + len(batch)}"
                )

                tasks = []
                for source in batch:
                    # Convert ParsedSource to dict for InclusionEvaluationService
                    source_content = {
                        "title": source.title,
                        "abstract": source.abstract,
                        "venue": source.venue,
                        "publication_date": str(source.publication_date)
                        if source.publication_date
                        else "",
                        "content_excerpt": "",  # No full text during import
                    }
                    tasks.append(
                        checker.evaluate_inclusion(
                            source_content=source_content,
                            inclusion_criteria=[
                                {"criterion": c} for c in inclusion_criteria
                            ],  # format for service
                            exclusion_criteria=[
                                {"criterion": c} for c in (exclusion_criteria or [])
                            ],
                            research_questions=research_questions,
                        )
                    )

                batch_results_dicts = await asyncio.gather(*tasks)

                for j, res in enumerate(batch_results_dicts):
                    # Map back to original index
                    source_idx = i + j

                    # Convert dict result to tuple expected by legacy response format
                    # (is_relevant, confidence, reasoning)
                    # Note: ImportOrchestrator.process_import return signature expects relevance_results
                    # to be Dict[int, tuple]

                    is_relevant = res["recommendation"]
                    confidence = res["overall_confidence"]
                    reasoning = (
                        res.get("inclusion_reasoning", "")
                        + " "
                        + res.get("exclusion_reasoning", "")
                    ).strip()

                    relevance_results[source_idx] = (is_relevant, confidence, reasoning)

            logger.info(
                "import_orchestrator: relevance check complete",
                extra={
                    "relevant_count": sum(1 for r in relevance_results.values() if r[0]),
                    "irrelevant_count": sum(1 for r in relevance_results.values() if not r[0]),
                },
            )

        return {
            "database_source": importer.get_database_name(),
            "parsed_sources": parsed_sources,
            "duplicates": duplicates,
            "new_sources": new_sources,
            "relevance_results": relevance_results,
        }

    async def stream_relevance_checks(
        self,
        new_sources: list[Any],
        research_questions: list[str],
        inclusion_criteria: list[str],
        exclusion_criteria: list[str] = None,
    ):
        """
        Stream relevance checks for a list of sources using concurrency control.
        Uses a Queue to emit 'started' events (when semaphore acquired)
        and 'progress' events (when finished).
        """
        from src.core.llm_provider import get_llm_provider
        from src.services.inclusion_evaluation_service import InclusionEvaluationService

        provider = get_llm_provider(prefer_small_model=True)
        checker = InclusionEvaluationService(provider)

        total = len(new_sources)
        print(f"DEBUG: import_orchestrator: stream_relevance_checks called for {total} sources")

        # Concurrency control
        semaphore = asyncio.Semaphore(5)  # Max 5 concurrent sources
        queue = asyncio.Queue()

        async def _bounded_check(source, idx):
            async with semaphore:
                # 1. Emit STARTED event
                await queue.put({"type": "started", "index": idx, "total": total})

                # Convert source to dict
                if hasattr(source, "dict"):
                    src_dict = source.dict()
                else:
                    src_dict = source if isinstance(source, dict) else source.__dict__

                source_content = {
                    "title": src_dict.get("title") or "Unknown Title",
                    "abstract": src_dict.get("abstract") or "",
                    "venue": src_dict.get("venue") or "",
                    "publication_date": src_dict.get("publication_date") or "",
                    "content_excerpt": "",
                }

                try:
                    res = await checker.evaluate_inclusion(
                        source_content=source_content,
                        inclusion_criteria=[{"criterion": c} for c in inclusion_criteria],
                        exclusion_criteria=[{"criterion": c} for c in (exclusion_criteria or [])],
                        research_questions=research_questions,
                    )

                    # Convert result
                    is_relevant = res["recommendation"]
                    confidence = res["overall_confidence"]
                    reasoning = (
                        res.get("inclusion_reasoning", "")
                        + " "
                        + res.get("exclusion_reasoning", "")
                    ).strip()
                    incl = res["inclusion_criteria"]
                    excl = res["exclusion_criteria"]

                    # 2. Emit PROGRESS (Completed) event
                    completed_payload = {
                        "type": "progress",
                        "index": idx,
                        "total": total,
                        # "completed" count is tracked by client or consumer,
                        # but we can't easily track global 'completed' inside this concurrent task
                        # without a shared counter. Client usually tracks 'completed' by counting progress events.
                        # We will include a placeholder or let consumer handle consistent counting if needed.
                        # For simplicity, we just send the result.
                        "source_title": source_content["title"],
                        "result": {
                            "is_relevant": is_relevant,
                            "confidence": confidence,
                            "reasoning": reasoning,
                            "inclusion_criteria": incl,
                            "exclusion_criteria": excl,
                        },
                    }
                    await queue.put(completed_payload)

                except Exception as e:
                    logger.exception(f"Error checking source {idx}")
                    await queue.put(
                        {"type": "error", "index": idx, "error": str(e), "total": total}
                    )

        # Launch worker tasks
        tasks = [asyncio.create_task(_bounded_check(s, i)) for i, s in enumerate(new_sources)]

        # Monitor task to close queue when done
        async def _monitor():
            await asyncio.gather(*tasks)
            await queue.put(None)  # Sentinel

        asyncio.create_task(_monitor())

        # Yield from queue
        completed_count = 0

        while True:
            event = await queue.get()
            if event is None:
                break

            # If it's a completion event, we can inject the 'completed' count if we want strictly ordered counts,
            # but usually client just increments.
            # The existing frontend logic (bulk-upload-form.tsx) expects 'completed' field in 'progress' event.
            if event.get("type") == "progress" or event.get("type") == "error":
                completed_count += 1
                event["completed"] = completed_count

                # Debug log
                if event.get("type") == "progress":
                    print(
                        f"DEBUG: import_orchestrator: task {event['index']} completed ({completed_count}/{total})"
                    )

            yield json.dumps(event) + "\n"
