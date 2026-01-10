"""Coding service for generating categories from OPEN facet values."""

import logging
from typing import Dict, Any, List, Optional

from src.core.llm_provider import LLMProvider

logger = logging.getLogger(__name__)


class CodingService:
    """Service for LLM-assisted coding of OPEN facet values into categories."""

    def __init__(self, llm_provider: LLMProvider):
        self.llm_provider = llm_provider

    async def suggest_categories(
        self,
        values: List[str],
        facet_name: str,
        facet_description: Optional[str] = None,
        min_categories: int = 3,
        max_categories: int = 10,
    ) -> Dict[str, Any]:
        """
        Generate category suggestions from a list of OPEN facet values.

        Uses LLM to cluster similar values and suggest meaningful category names.

        Args:
            values: List of unique values extracted from sources
            facet_name: Name of the facet being coded
            facet_description: Optional description of what this facet captures
            min_categories: Minimum number of categories to suggest
            max_categories: Maximum number of categories to suggest

        Returns:
            Dictionary with categories, uncategorized values, and reasoning
        """
        logger.info(f"Suggesting categories for facet '{facet_name}' with {len(values)} values")

        # Build the prompt
        values_list = "\n".join(f"- {v}" for v in values)
        description_text = f"\nDescription: {facet_description}" if facet_description else ""

        prompt = f"""You are helping a researcher organize data from a systematic mapping study.

The researcher has a facet called "{facet_name}" that collected free-text values from research papers.{description_text}

Here are all the unique values extracted:
{values_list}

Your task is to group these values into {min_categories}-{max_categories} meaningful categories.

Guidelines:
1. Categories should be mutually exclusive and collectively exhaustive
2. Use clear, descriptive category names suitable for academic writing
3. Group semantically similar values together (synonyms, related concepts)
4. Create an "Other/Unclassified" category only for truly miscellaneous values
5. Each category should have at least 2 values if possible

Respond with a JSON object containing:
- categories: array of objects with name (string), description (string), and values (array of strings that belong to this category)
- uncategorized: array of values that don't fit any category  
- reasoning: brief explanation of the categorization approach

Important: Include ALL values from the input in either a category or uncategorized. Do not miss any values."""

        try:
            # Use proper schema format for arrays - list with item schema as first element
            response_schema = {
                "categories": [
                    {
                        "name": "string",
                        "description": "string",
                        "values": ["string"],  # Array of strings
                    }
                ],
                "uncategorized": ["string"],  # Array of strings
                "reasoning": "string",
            }

            result = await self.llm_provider.generate_structured_output(
                prompt=prompt,
                response_schema=response_schema,
                max_tokens=4000,
            )

            # Ensure proper structure
            categories = result.get("categories", [])
            formatted_categories = []
            for cat in categories:
                if isinstance(cat, dict):
                    formatted_categories.append({
                        "name": cat.get("name", "Unknown"),
                        "description": cat.get("description", ""),
                        "values": cat.get("values", []),
                        "source_count": len(cat.get("values", [])),
                    })

            return {
                "categories": formatted_categories,
                "uncategorized": result.get("uncategorized", []),
                "reasoning": result.get("reasoning", ""),
            }

        except Exception as e:
            logger.error(f"Error suggesting categories: {e}")
            raise

    async def classify_value(
        self,
        value: str,
        categories: List[Dict[str, Any]],
        facet_name: str,
    ) -> Dict[str, Any]:
        """
        Classify a single value into one of the existing categories.

        Used for auto-categorizing new sources after coding is enabled.

        Args:
            value: The value to classify
            categories: Existing categories with id, name, description
            facet_name: Name of the facet

        Returns:
            Dictionary with category_id, category_name, confidence, and reasoning
        """
        logger.info(f"Classifying value '{value}' for facet '{facet_name}'")

        # Build categories description
        categories_desc = "\n".join(
            f"- {cat.get('name', 'Unknown')}: {cat.get('description', 'No description')}"
            for cat in categories
        )

        prompt = f"""You are classifying a value into predefined categories for a systematic mapping study.

Facet: "{facet_name}"

Available categories:
{categories_desc}

Value to classify: "{value}"

Determine which category this value best belongs to. If it doesn't clearly fit any category, classify it as null.

Respond with a JSON object containing:
- category_name: Name of the matching category (or null if no match)
- confidence: Number between 0.0-1.0
- reasoning: Brief explanation of why this classification was chosen

Confidence guidelines:
- 0.9-1.0: Very clear match (exact or near-exact terminology)
- 0.7-0.9: Good match (same concept, different wording)
- 0.5-0.7: Possible match (related but not certain)
- 0.0-0.5: Poor match (likely doesn't belong)

If confidence is below 0.5, set category_name to null."""

        try:
            response_schema = {
                "category_name": "string",
                "confidence": "number",
                "reasoning": "string",
            }

            result = await self.llm_provider.generate_structured_output(
                prompt=prompt,
                response_schema=response_schema,
                max_tokens=1000,
            )

            # Find the category ID from the name
            category_name = result.get("category_name")
            category_id = None

            if category_name:
                for cat in categories:
                    if cat.get("name", "").lower() == category_name.lower():
                        category_id = cat.get("id")
                        category_name = cat.get("name")  # Use exact casing
                        break

            confidence = float(result.get("confidence", 0.0))
            
            # If confidence is low, don't assign a category
            if confidence < 0.5:
                category_id = None
                category_name = None

            return {
                "category_id": category_id,
                "category_name": category_name,
                "confidence": confidence,
                "reasoning": result.get("reasoning", ""),
            }

        except Exception as e:
            logger.error(f"Error classifying value: {e}")
            raise
