"""Duplicate detection service for sources."""

import difflib
import re

from .base_importer import ParsedSource


class DuplicateDetector:
    """Service for detecting duplicate sources."""

    def __init__(self, existing_sources: list[dict]):
        """
        Initialize with existing sources from the database.

        Args:
            existing_sources: List of dicts with keys: id, doi, title, authors
        """
        self.existing_sources = existing_sources
        self.doi_map = {s["doi"]: s for s in existing_sources if s.get("doi")}
        self._build_title_author_index()

    def find_duplicate(self, candidate: ParsedSource) -> tuple[str, str] | None:
        """
        Check if candidate is a duplicate.

        Returns:
            (source_id, match_method) if duplicate found, None otherwise
            match_method: "doi" | "title_author"
        """
        # Strategy 1: DOI match (highest priority)
        if candidate.doi and candidate.doi in self.doi_map:
            return (self.doi_map[candidate.doi]["id"], "doi")

        # Strategy 2: Title + First Author similarity
        if candidate.title and candidate.authors:
            normalized_title = self._normalize_title(candidate.title)
            first_author = self._normalize_author(candidate.authors[0]) if candidate.authors else ""

            for existing in self.existing_sources:
                existing_title = self._normalize_title(existing.get("title", ""))
                existing_authors = existing.get("authors", [])
                existing_first = (
                    self._normalize_author(existing_authors[0]) if existing_authors else ""
                )

                # High similarity threshold (0.9) to avoid false positives
                title_similarity = difflib.SequenceMatcher(
                    None, normalized_title, existing_title
                ).ratio()
                author_match = first_author == existing_first

                if title_similarity > 0.9 and author_match:
                    return (existing["id"], "title_author")

        return None

    def _normalize_title(self, title: str) -> str:
        """Normalize title for comparison."""
        # Remove punctuation, lowercase, strip whitespace
        normalized = re.sub(r"[^\w\s]", "", title.lower())
        return " ".join(normalized.split())

    def _normalize_author(self, author: str) -> str:
        """Normalize author name for comparison."""
        return author.lower().strip()

    def _build_title_author_index(self):
        """Pre-build index for faster lookups."""
        # Could use more sophisticated indexing (e.g., elasticsearch) in the future
        pass
