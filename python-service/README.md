# SMS AI Service

Python FastAPI service for AI-powered analysis of research sources in Systematic Mapping Studies.

## Setup

1. Install dependencies:
```bash
uv sync
```

2. Configure environment variables:
Create a `.env` file with your API keys (see example below).

3. Run the service:
```bash
uv run uvicorn src.main:app --reload --port 8000
```

The service will be available at `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

## Dependencies

- FastAPI: Web framework
- SQLAlchemy: Database ORM
- Anthropic/OpenAI: LLM providers
- PyMuPDF & pdfplumber: PDF text extraction
- BeautifulSoup4: Web scraping

## Environment

Required variables (example values):

- `DATABASE_URL` - Postgres connection string
- `LLM_PROVIDER` - `auto` (default), `claude`, or `openai`
- `ANTHROPIC_API_KEY` - required for `claude` or when `auto` prefers Anthropic
- `OPENAI_API_KEY` - required for `openai` or fallback when Anthropic key missing
- `CLAUDE_MODEL` / `OPENAI_MODEL` (optional) - override default model names
- `CLAUDE_SMALL_MODEL` / `OPENAI_SMALL_MODEL` (optional) - small models for parsing
- `MAX_TOKENS`, `TEMPERATURE` (optional) - tuning knobs

Example `.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/sms
LLM_PROVIDER=auto
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
CLAUDE_MODEL=claude-3-5-sonnet-20241022
OPENAI_MODEL=gpt-4o-mini
MAX_TOKENS=4000
TEMPERATURE=0.1
```

To check connectivity without exposing keys, call:

```
GET /api/test-llm
```
Response includes `active_provider`, `model`, and `available_providers` without leaking secrets.

## Key endpoints

- `POST /api/analyze` — runs per-criterion inclusion/exclusion checks and classification; returns structured reasoning and confidence.
- `POST /api/parse-pdf` — extracts text (first N pages) and uses the small LLM to return metadata JSON (title, authors, abstract, venue, doi, publicationDate, excerpt, confidence).
- `GET /api/test-llm` — verifies provider configuration without exposing secrets.

