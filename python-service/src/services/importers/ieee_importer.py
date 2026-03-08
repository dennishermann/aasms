"""IEEE Xplore CSV importer."""

import io

import pandas as pd

from .base_importer import BaseImporter, ParsedSource


class IEEEImporter(BaseImporter):
    """Parser for IEEE Xplore CSV exports."""

    def get_database_name(self) -> str:
        return "IEEE"

    def can_handle(self, file_content: bytes, filename: str) -> bool:
        """Check for CSV extension and IEEE-specific headers."""
        if not filename.lower().endswith(".csv"):
            return False
        try:
            df = pd.read_csv(io.BytesIO(file_content), nrows=0)
            # IEEE has these specific columns
            ieee_headers = {"Document Title", "Authors", "DOI", "Publication Title"}
            return ieee_headers.issubset(set(df.columns))
        except Exception:
            return False

    async def parse(self, file_content: bytes, filename: str) -> list[ParsedSource]:
        """Parse IEEE CSV export."""
        df = pd.read_csv(io.BytesIO(file_content))
        sources = []

        for _, row in df.iterrows():
            # Parse PDF link if available
            pdf_link = row.get("PDF Link", "")
            url = (
                pdf_link
                if pd.notna(pdf_link) and pdf_link
                else (f"https://doi.org/{row['DOI']}" if pd.notna(row.get("DOI")) else "")
            )

            # Map IEEE columns to normalized format
            sources.append(
                ParsedSource(
                    title=str(row.get("Document Title", "")),
                    authors=self._parse_authors(row.get("Authors", "")),
                    abstract=str(row.get("Abstract", "")),
                    doi=str(row.get("DOI", "")),
                    url=url,
                    venue=str(row.get("Publication Title", "")),
                    publication_date=str(row.get("Publication Year", "")),
                    keywords=self._parse_keywords(row.get("Author Keywords", "")),
                    database_specific={
                        "ieee_id": row.get("Document Identifier"),
                        "pdf_link": pdf_link if pd.notna(pdf_link) else None,
                        "citation_count": row.get("Article Citation Count"),
                        "ieee_terms": row.get("IEEE Terms"),
                    },
                )
            )

        return sources

    def _parse_authors(self, authors_str: str) -> list[str]:
        """Parse IEEE author format: 'FirstInitial. Last; FirstInitial2. Last2'"""
        if pd.isna(authors_str):
            return []
        return [a.strip() for a in str(authors_str).split(";") if a.strip()]

    def _parse_keywords(self, keywords_str: str) -> list[str]:
        """Parse IEEE semicolon-separated keywords."""
        if pd.isna(keywords_str):
            return []
        return [k.strip() for k in str(keywords_str).split(";") if k.strip()]
