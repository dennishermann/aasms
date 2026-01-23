"""Structured classification schema for LLM outputs."""

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
                    "keywords": {"type": "array", "items": {"type": "string"}},
                    "confidence": {"type": "number"},
                    "reasoning": {"type": "string"},
                },
                "required": ["facet_name", "confidence", "reasoning"],
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



