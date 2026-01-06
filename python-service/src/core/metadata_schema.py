"""
Deprecated shim: re-export schemas from src.core.schemas.
Prefer importing from src.core.schemas.metadata or classification.
"""

from src.core.schemas.metadata import (  # noqa: F401
    METADATA_SCHEMA_NAME,
    METADATA_JSON_SCHEMA,
    METADATA_RESPONSE_FORMAT,
)
from src.core.schemas.classification import (  # noqa: F401
    CLASSIFICATION_SCHEMA_NAME,
    CLASSIFICATION_JSON_SCHEMA,
    CLASSIFICATION_RESPONSE_FORMAT,
)

# Classification response schema used for structured LLM outputs.
CLASSIFICATION_SCHEMA_NAME = "classification_v1"
CLASSIFICATION_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "classifications": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "facet_name": {"type": "string"},
                    "category": {"type": "string"},
                    "confidence": {"type": "number"},
                    "reasoning": {"type": "string"},
                },
                "required": ["facet_name", "category", "confidence"],
                "additionalProperties": False,
            },
            "minItems": 0,
        }
    },
    "required": ["classifications"],
    "additionalProperties": False,
}

CLASSIFICATION_RESPONSE_FORMAT = {
    "type": "json_schema",
    "name": CLASSIFICATION_SCHEMA_NAME,
    "schema": CLASSIFICATION_JSON_SCHEMA,
    "strict": True,
}

