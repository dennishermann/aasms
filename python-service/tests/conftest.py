"""Shared test fixtures for the SMS AI service."""

import pytest

from src.core.llm_provider import LLMProvider


class FakeProvider(LLMProvider):
    """A configurable fake LLM provider for testing."""

    def __init__(self, decision: bool = True, confidence: float = 0.9, reasoning: str = "test"):
        self.decision = decision
        self.confidence = confidence
        self.reasoning = reasoning
        self.call_count = 0
        self._responses: list[dict] | None = None
        self._should_raise: Exception | None = None

    def set_responses(self, responses: list[dict]):
        """Queue specific responses for sequential calls."""
        self._responses = list(responses)

    def set_error(self, error: Exception):
        """Make the provider raise an error on next call."""
        self._should_raise = error

    async def generate_completion(
        self, prompt, system_prompt=None, temperature=0.1, max_tokens=4000
    ):
        self.call_count += 1
        if self._should_raise:
            raise self._should_raise
        return "ok"

    async def generate_structured_output(
        self,
        prompt,
        system_prompt=None,
        response_schema=None,
        temperature=0.1,
        max_tokens=4000,
        previous_response_id=None,
    ):
        self.call_count += 1
        if self._should_raise:
            raise self._should_raise
        if self._responses:
            return self._responses.pop(0)

        # Detect classification vs inclusion based on schema
        is_classification = isinstance(response_schema, dict) and (
            "classifications" in response_schema
            or (
                "properties" in response_schema
                and "classifications" in response_schema["properties"]
            )
        )

        if is_classification:
            return {
                "classifications": [
                    {
                        "facet_name": "venue",
                        "category": "journal",
                        "confidence": self.confidence,
                        "reasoning": self.reasoning,
                    }
                ]
            }
        return {
            "criterion": "sample",
            "decision": self.decision,
            "confidence": self.confidence,
            "reasoning": self.reasoning,
        }


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
