from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_routes_mounted():
    """Verify that expected routes are mounted."""
    routes = [route.path for route in app.routes]

    expected_routes = [
        "/api/test-llm",
        "/api/classify/file",
        "/api/classify/text",
        "/api/analyze-inclusion/file",
        "/api/analyze-inclusion/text",
        "/api/analyze-existing-source-pdf",
        "/api/parse-text",
        "/api/parse-pdf",
        "/api/scrape-url",
        "/api/extract-authors",
        "/api/import/parse",
        "/api/import/check-relevance",
        "/api/process-import",
        "/api/import/process-batch-stream",
    ]

    for route in expected_routes:
        assert route in routes, f"Route {route} not found"


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_llm_config_check():
    # This might fail if no provider is configured in env, but let's check it returns 500 or 200, not 404
    response = client.get("/api/test-llm")
    assert response.status_code in [200, 500]
