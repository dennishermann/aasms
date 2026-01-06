"""
Service for extracting metadata from website content.
"""
import logging
from typing import Dict, Any, Optional

from src.core.llm_provider import LLMProvider
from src.core.schemas.metadata import METADATA_JSON_SCHEMA

logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False

class WebsiteMetadataService:
    """
    Domain service for extracting metadata from websites/blogs.
    Encapsulates specific prompting strategies for non-academic content.
    """
    
    def __init__(self, llm_provider: LLMProvider):
        self.llm_provider = llm_provider

    async def extract_metadata(
        self,
        text_content: str,
        url: str,
        title_hint: Optional[str] = None,
        model_name: Optional[str] = None # Deprecated, controlled by provider
    ) -> Dict[str, Any]:
        """
        Extract metadata from raw website text.
        """
        logger.info(f"WebsiteMetadataService: extraction requested for {url}")
        logger.info(f"Input text length: {len(text_content)} characters")
        
        prompt = self._build_prompt(text_content, url, title_hint)
        logger.debug(f"Prompt constructed. Length: {len(prompt)}")
        
        try:
            result = await self.llm_provider.generate_structured_output(
                prompt=prompt,
                response_schema=METADATA_JSON_SCHEMA,
                max_tokens=16000,
            )
            
            # Post-processing if needed
            result["confidence"] = result.get("confidence", 0.0)
            logger.info(f"Extraction result: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Website extraction failed: {e}")
            raise

    def _build_prompt(self, text_content: str, url: str, title_hint: Optional[str]) -> str:
        """
        Construct a persona-based prompt for website analysis.
        """
        
        return (
            "You are an expert Research Librarian and Technical Editor. "
            "Your goal is to extract structured bibliographic metadata from the provided web content.\n\n"
            "<instructions>\n"
            "1. **Analyze** the content to identify core metadata: Title, Authors, Publication Date, and Content Summary.\n"
            "2. **Authors / Team**: \n"
            "   - Look for 'By' lines, 'Written by', or author bios at the top or bottom.\n"
            "   - **CRITICAL**: If no individual person is named, look for 'Team' or 'Company' attribution (e.g., 'Anthropic', 'The OpenAI Team', 'Google DeepMind').\n"
            "   - Treat these organizational names as valid authors. Do not leave Authors empty if an organization is clearly the creator.\n"
            "   - If multiple authors, list them all.\n"
            "3. **Date**: Prefer specific dates (YYYY-MM-DD). If only '3 days ago', estimate based on current year or leave empty if unsure.\n"
            "4. **Venue**: Use the domain name or website name (e.g., 'Anthropic Blog', 'Medium', 'TechCrunch') as the Venue.\n"
            "5. **Abstract/Summary**: \n"
            "   - **CRITICAL**: Ignore generic 'meta descriptions'.\n"
            "   - **ACTION**: Read the FULL provided content and generate a high-quality, content-rich summary (3-4 sentences) that captures the core technical concepts and arguments.\n"
            "   - Set 'isGeneratedSummary' to true.\n"
            "6. **Content Excerpt**: Keep the first ~1000 characters of the main text verbatim.\n"
            "</instructions>\n\n"
            "<input_context>\n"
            f"URL: {url}\n"
            f"Page Title Hint: {title_hint or 'Unknown'}\n"
            "</input_context>\n\n"
            f"<content>\n{text_content}\n</content>\n"
        )
