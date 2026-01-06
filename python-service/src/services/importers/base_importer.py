"""Base importer class for database-specific importers."""

from abc import ABC, abstractmethod
from typing import Dict, List, Any
from pydantic import BaseModel


class ParsedSource(BaseModel):
    """Normalized source metadata from any database."""
    
    title: str
    authors: List[str]
    abstract: str = ""
    doi: str = ""
    url: str = ""
    venue: str = ""
    publication_date: str = ""
    keywords: List[str] = []
    bibtex: str = ""
    database_specific: Dict[str, Any] = {}  # Store raw fields


class BaseImporter(ABC):
    """Abstract base for database-specific importers."""
    
    @abstractmethod
    def get_database_name(self) -> str:
        """Return the database identifier (e.g., 'IEEE', 'ACM')."""
        pass
    
    @abstractmethod
    def can_handle(self, file_content: bytes, filename: str) -> bool:
        """
        Validate if file format matches this importer.
        
        Used to verify that the user selected the correct database source.
        Returns False if file doesn't have expected headers/format.
        """
        pass
    
    @abstractmethod
    async def parse(self, file_content: bytes, filename: str) -> List[ParsedSource]:
        """Parse the file and return normalized source metadata."""
        pass
