# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SMS Assistant (Systematic Mapping Study Assistant) — an AI-powered tool for conducting systematic mapping studies in software engineering. Three components: a Next.js frontend, a FastAPI python-service, and a Chrome extension.

## Development Commands

### Infrastructure
```bash
docker compose up -d                # Start PostgreSQL 16 + MinIO (required first)
```

### Frontend (Next.js 16+ / TypeScript / React 19)
```bash
cd frontend
npm install
npm run db:generate                 # Generate Prisma client
npm run db:push                     # Push schema to database
npm run dev                         # Dev server on :3000
npm run build                       # Production build
npm run lint                        # ESLint
npm run db:studio                   # Prisma Studio GUI
npm run db:migrate                  # Run Prisma migrations
```

### Python Service (FastAPI / Python 3.11+)
```bash
cd python-service
uv sync                             # Install dependencies
uv run uvicorn src.main:app --reload --port 8000   # Dev server on :8000
uv run pytest                       # Run tests
uv run pytest tests/test_foo.py     # Run single test file
uv run pytest -k "test_name"        # Run single test by name
```

### Chrome Extension
No build step. Load unpacked from `chrome-extension/` via `chrome://extensions`.

## Architecture

### Three-Service Architecture
- **Frontend** (`frontend/`): Next.js App Router. Serves UI and API routes. Connects to PostgreSQL via Prisma and MinIO for file storage.
- **Python Service** (`python-service/`): FastAPI. Handles all AI/LLM operations — inclusion analysis, classification, open coding, PDF parsing, web scraping, bulk imports. Frontend calls it at `PYTHON_SERVICE_URL`.
- **Chrome Extension** (`chrome-extension/`): Manifest v3. Extracts metadata from academic publisher sites (ACM, IEEE, arXiv, Springer, Scopus, ScienceDirect) and sends to the frontend API.

### Database (Prisma schema in `frontend/prisma/schema.prisma`)
Core model chain: **Study** → **Source** → **SourceAnalysis** → **Classification** / **AnalysisVote**. Studies have **Facets** (classification dimensions) with **FacetCategories**. Facets come in three types: CLOSED (predefined categories), OPEN (free-text), OPEN_CODED (emergent categories via coding wizard). **RqRecipe** / **RqRun** power the analysis dashboard.

### Key Patterns

**Multi-LLM Voting**: When multiple LLM providers are configured (Claude, OpenAI, Gemini), the system runs per-criterion majority voting for inclusion/exclusion decisions. Votes stored in `AnalysisVote`. Configured via `LLM_PROVIDER` env var (`auto` detects available keys).

**LLM Abstraction** (`python-service/src/core/llm_provider.py` + `src/services/llm_client.py`): Unified interface across Claude, OpenAI, and Gemini. All LLM calls go through `generate_json()` which returns structured responses.

**Batch Operations**: SSE-based streaming for progress updates during batch analyze/classify. Frontend shows real-time progress via `batch-progress-modal.tsx`.

**Analysis Dimensions** (`frontend/lib/services/analysis/dimension-utils.ts`): Reusable dimension system for frequency, crosstab, timeseries, and gap analyses. Supports filtering by status, decision, facet values, and metadata fields.

**Metadata Binding**: Facets can bind to source metadata fields (e.g., publicationDate, venue) with transforms, auto-populating classifications without LLM calls.

### Frontend Conventions
- **State**: TanStack React Query for server state; React Context for import workflow
- **API routes**: `app/api/studies/[id]/...` — RESTful, return `NextResponse.json()`
- **Hooks**: Custom hooks in `hooks/` encapsulate page-level data fetching and mutations
- **UI**: shadcn/ui (Radix primitives) + Tailwind CSS 4 + Lucide icons + ECharts
- **Validation**: Zod schemas in `lib/validations.ts`
- **DB client**: Singleton in `lib/db.ts`; MinIO client in `lib/minio.ts`
- **File naming**: kebab-case for files, PascalCase for components

### Python Service Conventions
- **Package manager**: uv (not pip)
- **Routers**: `src/api/routers/` — each router handles a domain (analysis, coding, imports, parsing, scraping)
- **Services**: `src/services/` — business logic separated from routes
- **Config**: pydantic-settings in `src/core/config.py`, reads from `.env`
- **Retry/rate-limit**: tenacity for retries, aiolimiter for API throttling

## Report Writing
- When writing or editing `report/report.tex`, follow the rules in `report/WRITING_RULES.md`
- Track implementation items discovered during writing in `report/BACKLOG.md`

## Testing
- **Always** add tests for new features and endpoints
- **Frontend unit tests**: Vitest with jsdom environment. Run `npm run test` in `frontend/`. Test files use `*.test.ts` or `*.test.tsx` suffix
- **Frontend e2e tests**: Playwright specs in `frontend/e2e/`. Run `npm run test:e2e` in `frontend/`
- **Python service tests**: pytest. Run `uv run pytest` in `python-service/`
- **API route tests**: Mock Prisma client via `vi.mock("@/lib/db")` and test request/response behavior

## Git Conventions
- **Never** add "Co-Authored-By" lines to commit messages
