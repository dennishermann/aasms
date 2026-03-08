"""ACM Digital Library BibTeX importer."""

import bibtexparser
from bibtexparser.bparser import BibTexParser

from .base_importer import BaseImporter, ParsedSource

# Month name to number mapping
MONTH_MAP = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


class ACMImporter(BaseImporter):
    """Parser for ACM Digital Library BibTeX exports."""

    def get_database_name(self) -> str:
        return "ACM"

    def can_handle(self, file_content: bytes, filename: str) -> bool:
        """Check for BibTeX extension and content."""
        if not filename.lower().endswith((".bib", ".bibtex")):
            return False
        try:
            content = file_content.decode("utf-8")
            return "@" in content and "author" in content.lower()
        except Exception:
            return False

    async def parse(self, file_content: bytes, filename: str) -> list[ParsedSource]:
        """Parse ACM BibTeX export."""
        content = file_content.decode("utf-8")
        parser = BibTexParser(common_strings=True)
        bib_db = bibtexparser.loads(content, parser=parser)

        sources = []
        for entry in bib_db.entries:
            # Generate BibTeX for this entry
            single_bib = bibtexparser.bibdatabase.BibDatabase()
            single_bib.entries = [entry]
            entry_bibtex = bibtexparser.dumps(single_bib)

            sources.append(
                ParsedSource(
                    title=entry.get("title", ""),
                    authors=self._parse_bibtex_authors(entry.get("author", "")),
                    abstract=entry.get("abstract", ""),
                    doi=entry.get("doi", ""),
                    url=entry.get(
                        "url", f"https://doi.org/{entry['doi']}" if "doi" in entry else ""
                    ),
                    venue=entry.get("booktitle", entry.get("journal", "")),
                    publication_date=self._parse_publication_date(
                        entry.get("year", ""), entry.get("month", "")
                    ),
                    keywords=self._parse_keywords(entry.get("keywords", "")),
                    bibtex=entry_bibtex,
                    database_specific={
                        "entry_type": entry.get("ENTRYTYPE"),
                        "year": entry.get("year"),
                    },
                )
            )

        return sources

    def _parse_bibtex_authors(self, authors_str: str) -> list[str]:
        """Parse BibTeX author format: 'Last, First and Last2, First2'"""
        if not authors_str:
            return []
        return [a.strip() for a in authors_str.split(" and ") if a.strip()]

    def _parse_keywords(self, keywords_str: str) -> list[str]:
        """Parse comma-separated keywords."""
        if not keywords_str:
            return []
        return [k.strip() for k in keywords_str.split(",") if k.strip()]

    def _parse_publication_date(self, year: str, month: str) -> str:
        """
        Parse BibTeX year and month into ISO date format.

        - If both year and month: returns YYYY-MM-15 (mid-month)
        - If only year: returns YYYY-12-31 (end of year, more accurate than Jan 1)
        - If neither: returns empty string
        """
        if not year:
            return ""

        try:
            year_int = int(year.strip())
        except ValueError:
            return year  # Return as-is if not a valid year

        # Try to parse month
        month_int = None
        if month:
            month_lower = month.strip().lower()
            # Try as month name
            month_int = MONTH_MAP.get(month_lower)
            # Try as number
            if month_int is None:
                try:
                    month_int = int(month_lower)
                    if not 1 <= month_int <= 12:
                        month_int = None
                except ValueError:
                    pass

        if month_int:
            # Use mid-month (15th) as a reasonable approximation
            return f"{year_int:04d}-{month_int:02d}-15"
        else:
            # Year only - use December 31st (end of year is more accurate than Jan 1st)
            return f"{year_int:04d}-12-31"
