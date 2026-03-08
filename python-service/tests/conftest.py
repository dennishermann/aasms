"""Shared test fixtures for the SMS AI service."""

import pytest

from src.core.fake_provider import FakeProvider


@pytest.fixture
def fake_provider():
    """Create a FakeProvider with default settings."""
    return FakeProvider()


@pytest.fixture
def fake_provider_factory():
    """Factory to create FakeProviders with custom settings."""

    def _create(decision: bool = True, confidence: float = 0.9, reasoning: str = "test"):
        return FakeProvider(decision=decision, confidence=confidence, reasoning=reasoning)

    return _create
