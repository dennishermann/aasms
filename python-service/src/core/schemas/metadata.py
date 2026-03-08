"""Structured metadata extraction schema."""

METADATA_SCHEMA_NAME = "metadata_extraction_v1"

METADATA_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "authors": {"type": "array", "items": {"type": "string"}},
        "abstract": {"type": "string"},
        "publicationDate": {"type": "string"},
        "venue": {"type": "string"},
        "doi": {"type": "string"},
        "confidence": {"type": "number"},
        "content_excerpt": {"type": "string"},
        "bibtex": {"type": "string"},
        "isGeneratedSummary": {"type": "boolean"},
    },
    # Strict responses require every property to be listed in "required".
    "required": [
        "title",
        "authors",
        "abstract",
        "publicationDate",
        "venue",
        "doi",
        "confidence",
        "content_excerpt",
        "bibtex",
        "isGeneratedSummary",
    ],
    "additionalProperties": False,
}

METADATA_RESPONSE_FORMAT = {
    "type": "json_schema",
    "name": METADATA_SCHEMA_NAME,
    "schema": METADATA_JSON_SCHEMA,
    "strict": True,
}
