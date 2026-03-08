"""Database connection and utilities for SMS AI Service."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from src.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Create engine
engine = create_engine(
    settings.database_url,
    echo=False,  # Set to True for debugging SQL queries
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    """Get a database session."""
    db = SessionLocal()
    try:
        return db
    except Exception as e:
        db.close()
        logger.error(f"Database connection error: {e}")
        raise


def close_db(db: Session) -> None:
    """Close a database session."""
    if db:
        db.close()
