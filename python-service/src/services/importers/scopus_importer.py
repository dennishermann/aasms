"""SCOPUS CSV importer."""

import io

import pandas as pd

from .base_importer import BaseImporter, ParsedSource


class ScopusImporter(BaseImporter):
    """Parser for SCOPUS CSV exports."""

    def get_database_name(self) -> str:
        return "SCOPUS"

    def can_handle(self, file_content: bytes, filename: str) -> bool:
        """Check for CSV extension and SCOPUS-specific headers."""
        if not filename.lower().endswith(".csv"):
            return False
        try:
            df = pd.read_csv(io.BytesIO(file_content), nrows=0)
            # SCOPUS has these specific columns
            scopus_headers = {"Title", "Authors", "DOI", "Source title", "EID"}
            return scopus_headers.issubset(set(df.columns))
        except (pd.errors.ParserError, pd.errors.EmptyDataError, KeyError, ValueError, UnicodeDecodeError):
            return False

    async def parse(self, file_content: bytes, filename: str) -> list[ParsedSource]:
        """Parse SCOPUS CSV export."""
        df = pd.read_csv(io.BytesIO(file_content))
        sources = []

        for _, row in df.iterrows():
            # SCOPUS provides both DOI and Link
            url = row.get("Link", "")
            if not pd.notna(url) or not url:
                url = f"https://doi.org/{row['DOI']}" if pd.notna(row.get("DOI")) else ""

            # Map SCOPUS columns to normalized format
            sources.append(
                ParsedSource(
                    title=str(row.get("Title", "")),
                    authors=self._parse_authors(row.get("Authors", "")),
                    abstract=str(row.get("Abstract", "")),
                    doi=str(row.get("DOI", "")),
                    url=url,
                    venue=str(row.get("Source title", "")),  # Journal/conference name
                    publication_date=str(row.get("Year", "")),
                    keywords=self._parse_keywords(row.get("Author Keywords", "")),
                    database_specific={
                        "scopus_eid": row.get("EID"),
                        "document_type": row.get("Document Type"),
                        "cited_by": row.get("Cited by"),
                        "open_access": row.get("Open Access"),
                        "volume": row.get("Volume"),
                        "issue": row.get("Issue"),
                    },
                )
            )

        return sources

    def _parse_authors(self, authors_str: str) -> list[str]:
        """Parse SCOPUS author format: 'Last, FirstInitial.; Last2, FirstInitial2.'"""
        if pd.isna(authors_str):
            return []
        return [a.strip() for a in str(authors_str).split(";") if a.strip()]

    def _parse_keywords(self, keywords_str: str) -> list[str]:
        """Parse SCOPUS semicolon-separated keywords."""
        if pd.isna(keywords_str):
            return []
        return [k.strip() for k in str(keywords_str).split(";") if k.strip()]
