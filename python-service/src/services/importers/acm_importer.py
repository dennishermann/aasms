"""ACM Digital Library BibTeX importer."""

import bibtexparser
from bibtexparser.bparser import BibTexParser
from typing import List
from .base_importer import BaseImporter, ParsedSource


class ACMImporter(BaseImporter):
    """Parser for ACM Digital Library BibTeX exports."""
    
    def get_database_name(self) -> str:
        return "ACM"
    
    def can_handle(self, file_content: bytes, filename: str) -> bool:
        """Check for BibTeX extension and content."""
        if not filename.lower().endswith(('.bib', '.bibtex')):
            return False
        try:
            content = file_content.decode('utf-8')
            return '@' in content and 'author' in content.lower()
        except Exception:
            return False
    
    async def parse(self, file_content: bytes, filename: str) -> List[ParsedSource]:
        """Parse ACM BibTeX export."""
        content = file_content.decode('utf-8')
        parser = BibTexParser(common_strings=True)
        bib_db = bibtexparser.loads(content, parser=parser)
        
        sources = []
        for entry in bib_db.entries:
            # Generate BibTeX for this entry
            single_bib = bibtexparser.bibdatabase.BibDatabase()
            single_bib.entries = [entry]
            entry_bibtex = bibtexparser.dumps(single_bib)
            
            sources.append(ParsedSource(
                title=entry.get('title', ''),
                authors=self._parse_bibtex_authors(entry.get('author', '')),
                abstract=entry.get('abstract', ''),
                doi=entry.get('doi', ''),
                url=entry.get('url', f"https://doi.org/{entry['doi']}" if 'doi' in entry else ''),
                venue=entry.get('booktitle', entry.get('journal', '')),
                publication_date=entry.get('year', ''),
                keywords=self._parse_keywords(entry.get('keywords', '')),
                bibtex=entry_bibtex,
                database_specific={'entry_type': entry.get('ENTRYTYPE')}
            ))
        
        return sources
    
    def _parse_bibtex_authors(self, authors_str: str) -> List[str]:
        """Parse BibTeX author format: 'Last, First and Last2, First2'"""
        if not authors_str:
            return []
        return [a.strip() for a in authors_str.split(' and ') if a.strip()]
    
    def _parse_keywords(self, keywords_str: str) -> List[str]:
        """Parse comma-separated keywords."""
        if not keywords_str:
            return []
        return [k.strip() for k in keywords_str.split(',') if k.strip()]
