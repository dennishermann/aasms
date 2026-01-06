"""Prompt templates for LLM analysis."""

from src.core.schemas.metadata import METADATA_SCHEMA_NAME

INCLUSION_EXCLUSION_PROMPT = """You are analyzing a research document for a systematic mapping study in software engineering.

Study Context:
Research Questions:
{research_questions}

Inclusion Criteria:
{inclusion_criteria}

Exclusion Criteria:
{exclusion_criteria}

Document to Analyze:
Title: {title}
Authors: {authors}
Abstract: {abstract}
Content Excerpt: {content_excerpt}

Task:
Analyze this document and determine whether it should be INCLUDED or EXCLUDED from the systematic mapping study based on the criteria above.

Provide your analysis as a JSON object with the following structure:
{{
  "recommendation": "include" or "exclude",
  "inclusion_reasoning": "Detailed explanation of how the document meets or fails inclusion criteria",
  "exclusion_reasoning": "Detailed explanation of how the document relates to exclusion criteria",
  "confidence": 0.0-1.0 (your confidence in this recommendation),
  "relevant_criteria_met": ["list of specific criteria that apply"],
  "key_findings": "Brief summary of key relevant findings in the document"
}}

Respond ONLY with the JSON object, no additional text.
"""

CLASSIFICATION_PROMPT = """You are classifying a research document according to a predefined classification schema for a systematic mapping study.

Document Information:
Title: {title}
Authors: {authors}
Abstract: {abstract}
Content Excerpt: {content_excerpt}

Classification Schema:
{classification_schema}

Task:
Classify this document according to each facet in the classification schema above.

Provide your classification as a JSON object with the following structure:
{{
  "classifications": [
    {{
      "facet_name": "name of the facet",
      "category": "selected category from the facet",
      "confidence": 0.0-1.0,
      "reasoning": "brief explanation for this classification"
    }},
    ...
  ]
}}

Respond ONLY with the JSON object, no additional text.
"""

COMBINED_ANALYSIS_PROMPT = """You are analyzing a research document for a systematic mapping study in software engineering.

Study Context:
Research Questions:
{research_questions}

Inclusion Criteria:
{inclusion_criteria}

Exclusion Criteria:
{exclusion_criteria}

Classification Schema:
{classification_schema}

Document to Analyze:
Title: {title}
Authors: {authors}
Publication Date: {publication_date}
Venue: {venue}
Abstract: {abstract}
Full Text Excerpt: {content_excerpt}

Task:
1. Determine whether this document should be INCLUDED or EXCLUDED from the study
2. Classify the document according to the classification schema
3. Assess the overall relevance and quality

Provide your complete analysis as a JSON object with the following structure:
{{
  "recommendation": "include" or "exclude",
  "inclusion_reasoning": "Detailed explanation of how the document meets or fails inclusion criteria",
  "exclusion_reasoning": "Detailed explanation of how the document relates to exclusion criteria",
  "confidence": 0.0-1.0,
  "relevant_criteria_met": ["list of specific criteria that apply"],
  "classifications": [
    {{
      "facet_name": "name of the facet",
      "category": "selected category",
      "confidence": 0.0-1.0,
      "reasoning": "brief explanation"
    }}
  ],
  "relevance_score": 0.0-1.0,
  "quality_notes": "Assessment of the document's quality and relevance"
}}

Respond ONLY with the JSON object, no additional text.
"""


def format_research_questions(questions: list) -> str:
    """Format research questions as a numbered list."""
    if not questions:
        return "No research questions specified"
    return "\n".join([f"{i+1}. {q}" for i, q in enumerate(questions)])


def format_criteria(criteria: list) -> str:
    """Format criteria as a numbered list."""
    if not criteria:
        return "No criteria specified"
    return "\n".join([f"{i+1}. {c}" for i, c in enumerate(criteria)])


def format_classification_schema(schema: dict) -> str:
    """Format classification schema with different instructions for closed vs open facets."""
    if not schema:
        return "No classification schema specified"

    formatted = []

    # Support both dict-based and list-based schemas
    if isinstance(schema, list):
        for facet in schema:
            facet_name = facet.get("name") or facet.get("facet_name") or "Unknown facet"
            facet_type = facet.get("type", "closed")  # Default to closed for backward compatibility
            categories = facet.get("categories", [])
            required = facet.get("required", False)
            
            req_str = "REQUIRED" if required else "OPTIONAL"
            formatted.append(f"\n{facet_name}:\n  Status: {req_str}")
            if facet.get("description"):
                formatted.append(f"  Description: {facet['description']}")
            
            if facet_type == "open":
                # Open-set: instruct LLM to generate category
                formatted.append("  Type: OPEN-SET (Generate an appropriate category based on document content)")
                if categories:  # If examples provided
                    formatted.append(f"  Example categories (for guidance): {', '.join(categories)}")
                if required:
                    formatted.append("  Instructions: You MUST analyze the document and create a category. Do not skip.")
                else:
                    formatted.append("  Instructions: Create a category if relevant information is present. If not, you MUST use 'Not Applicable' and provide reasoning.")
            else:
                # Closed-set: must choose from list
                formatted.append("  Type: CLOSED-SET (Must select ONE from the predefined list)")
                if categories:
                    formatted.append("  Allowed categories:")
                    for cat in categories:
                        formatted.append(f"    - {cat}")
                else:
                    formatted.append("  ERROR: No categories defined for closed-set facet")
                
                if not required:
                    formatted.append("  Note: This facet is optional. If the document does not contain enough information, you MUST select 'Not Applicable' and provide reasoning.")
    else:
        for facet_name, facet_data in schema.items():
            # Legacy dict support or new dict format
            formatted.append(f"\n{facet_name}:")
            
            if isinstance(facet_data, dict):
                facet_type = facet_data.get("type", "closed")
                categories = facet_data.get("categories", [])
                required = facet_data.get("required", False)
                
                req_str = "REQUIRED" if required else "OPTIONAL"
                formatted.append(f"  Status: {req_str}")
                
                if "description" in facet_data:
                    formatted.append(f"  Description: {facet_data['description']}")
                
                if facet_type == "open":
                    formatted.append("  Type: OPEN-SET (Generate an appropriate category based on document content)")
                    if categories:
                        formatted.append(f"  Example categories (for guidance): {', '.join(categories)}")
                    if required:
                         formatted.append("  Instructions: You MUST analyze the document and create a category.")
                    else:
                         formatted.append("  Instructions: Create a category if relevant information is present. If not, you MUST use 'Not Applicable' and provide reasoning.")

                else:
                    formatted.append("  Type: CLOSED-SET (Must select ONE from the predefined list)")
                    if categories:
                        formatted.append("  Allowed categories:")
                        for cat in categories:
                            formatted.append(f"    - {cat}")
                        
                        if not required:
                            formatted.append("  Note: This facet is optional. If not applicable, select 'Not Applicable'.")
            elif isinstance(facet_data, list):
                # Old format: assume closed-set with list of categories
                formatted.append("  Type: CLOSED-SET (Must select ONE from the predefined list)")
                formatted.append("  Allowed categories:")
                for cat in facet_data:
                    formatted.append(f"    - {cat}")

    return "\n".join(formatted)


def format_document_context(source_content: dict) -> str:
    """Format core document fields for prompting."""
    title = source_content.get("title") or "Unknown title"
    authors = source_content.get("authors") or "Unknown authors"
    abstract = source_content.get("abstract") or ""
    publication_date = source_content.get("publication_date") or source_content.get("published_at") or ""
    venue = source_content.get("venue") or source_content.get("publication") or ""
    excerpt = source_content.get("content_excerpt") or source_content.get("content") or ""
    return (
        f"Title: {title}\n"
        f"Authors: {authors}\n"
        f"Publication Date: {publication_date}\n"
        f"Venue: {venue}\n"
        f"Abstract: {abstract}\n"
        f"Content Excerpt: {excerpt}\n"
    )


def build_metadata_extraction_prompt(
    text_excerpt: str,
    pdf_metadata: dict | None = None,
    pdf_base64: str | None = None,
) -> str:
    """Prompt to extract structured metadata from a PDF excerpt."""
    pdf_meta_text = ""
    if pdf_metadata:
        pdf_meta_text = "\nPDF Metadata (may be incomplete):\n" + "\n".join(
            [
                f"- {k}: {v}"
                for k, v in pdf_metadata.items()
                if k != "raw" and v
            ]
        )

    pdf_blob_text = ""
    if pdf_base64:
        pdf_blob_text = "\nPDF excerpt (first pages) base64-encoded:\n" + pdf_base64

    return f"""
You are a research assistant extracting metadata from a PDF paper excerpt.

Use the response schema "{METADATA_SCHEMA_NAME}" exactly.

{pdf_meta_text}
{pdf_blob_text}

Text excerpt (may be partial, first pages only):
\"\"\"{text_excerpt}\"\"\"

Return ONLY JSON with:
{{
  "title": "string",
  "authors": ["Author 1", "Author 2"],
  "abstract": "string",
  "publicationDate": "YYYY-MM-DD or empty if unknown",
  "venue": "string",
  "doi": "string",
  "content_excerpt": "short snippet that supports the metadata",
  "confidence": 0.0-1.0
}}

If a field is unknown, use an empty string (or [] for authors).
Do not include any text outside the JSON. The response must be valid JSON.
"""


def build_per_criterion_prompt(
    criterion: str,
    source_content: dict,
    research_questions: list,
    inclusion: bool = True,
) -> str:
    """Create a focused prompt for a single inclusion/exclusion criterion."""
    criterion_type = "Inclusion" if inclusion else "Exclusion"
    rq_text = format_research_questions(research_questions)
    doc_context = format_document_context(source_content)
    return f"""
You are assessing a research document for a systematic mapping study.

Research Questions:
{rq_text}

{criterion_type} Criterion:
- {criterion}

Document:
{doc_context}

Task:
Decide whether the document satisfies this {criterion_type.lower()} criterion.
Respond ONLY with JSON:
{{
  "criterion": "{criterion}",
  "decision": true or false,
  "confidence": 0.0-1.0,
  "reasoning": "brief justification grounded in the text"
}}
"""


def build_classification_prompt(
    source_content: dict,
    classification_schema: dict,
    research_questions: list,
) -> str:
    """Create a prompt for classifying a source across facets."""
    rq_text = format_research_questions(research_questions)
    doc_context = format_document_context(source_content)
    schema_text = format_classification_schema(classification_schema)
    return f"""
You are classifying a research document for a systematic mapping study.

Research Questions:
{rq_text}

Document:
{doc_context}

Classification Schema:
{schema_text}

Task:
Classify the document according to each facet in the schema above.

IMPORTANT INSTRUCTIONS:
- For CLOSED-SET facets: You MUST select exactly ONE category from the predefined list of allowed categories.
- For OPEN-SET facets: Generate a concise, descriptive category name (1-4 words) that best characterizes this aspect of the document. Be specific and precise.

Return JSON with a list of classifications per facet:
{{
  "classifications": [
    {{
      "facet_name": "exact facet name from schema",
      "category": "selected category (from list for closed-set, or generated for open-set)",
      "confidence": 0.0-1.0,
      "reasoning": "brief evidence from the document"
    }}
  ]
}}

Respond ONLY with JSON, no additional text.
"""


def build_per_facet_prompt(
    facet_data: dict,
    source_content: dict,
    research_questions: list,
) -> str:
    """Create a prompt for classifying a source against a SINGLE facet."""
    rq_text = format_research_questions(research_questions)
    doc_context = format_document_context(source_content)
    
    # Format just this single facet's schema
    # We wrap it in a list to reuse the existing formatter's logic for a single item
    schema_text = format_classification_schema([facet_data])

    return f"""
You are classifying a research document for a systematic mapping study.

Research Questions:
{rq_text}

Document:
{doc_context}

Target Classification Facet:
{schema_text}

Task:
Classify the document according to the target facet above.

IMPORTANT INSTRUCTIONS:
- For CLOSED-SET facets: You MUST select exactly ONE category from the predefined list.
- For OPEN-SET facets: Generate a concise, descriptive category name (1-4 words).
- If the facet is OPTIONAL and the document has no relevant info, you MUST select 'Not Applicable' and provide reasoning.

Return JSON:
{{
  "facet_name": "{facet_data.get('name') or facet_data.get('facet_name')}",
  "category": "selected category",
  "confidence": 0.0-1.0,
  "reasoning": "brief evidence from the document"
}}

Respond ONLY with JSON, no additional text.
"""

