"""
Deprecated shim: re-export schemas from src.core.schemas.
Prefer importing from src.core.schemas.metadata or classification.
"""

from src.core.schemas.classification import (  # noqa: F401
    CLASSIFICATION_JSON_SCHEMA,
    CLASSIFICATION_RESPONSE_FORMAT,
    CLASSIFICATION_SCHEMA_NAME,
)
from src.core.schemas.metadata import (  # noqa: F401
    METADATA_JSON_SCHEMA,
    METADATA_RESPONSE_FORMAT,
    METADATA_SCHEMA_NAME,
)
