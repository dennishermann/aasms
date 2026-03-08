# SMS Assistant - Systematic Mapping Study Assistant

An AI-powered research tool for conducting **Systematic Mapping Studies (SMS)** in software engineering and other research domains. This application streamlines the entire SMS workflow, from literature import to analysis and visualization.

## What is a Systematic Mapping Study?

A Systematic Mapping Study is a structured methodology for categorizing and synthesizing existing research in a specific domain. SMS Assistant automates many tedious aspects of this process, including:

- **Literature Collection**: Bulk import from academic databases (IEEE Xplore, ACM Digital Library, Scopus)
- **Screening**: AI-powered inclusion/exclusion evaluation based on your criteria
- **Classification**: Automated categorization of sources according to your classification schema
- **Analysis**: Interactive visualizations and data tables for synthesis

---

## Features

### 📚 Study Management
- Create and manage multiple studies with research questions
- Define inclusion/exclusion criteria for systematic screening
- Configure classification schemas with facets and categories
- Track study progress and status

### 📥 Source Management
- **Bulk Import**: Import CSV/BibTeX exports from IEEE, ACM, and Scopus with automatic duplicate detection
- **Chrome Extension**: Add individual papers directly from academic databases with metadata extraction
- **PDF Upload**: Upload PDFs with automatic text extraction and metadata parsing
- **Web Sources**: Add web pages and grey literature (blogs, technical reports)

### 🤖 AI-Powered Analysis
- **Inclusion Evaluation**: LLM evaluates each source against your inclusion/exclusion criteria
- **Classification**: Automatic categorization according to your facet schema
- **Open Coding**: LLM suggests categories from free-text responses.
- **Coding Wizard**: Interactive interface to refine and organize open codes into a structured schema.
- **Multi-LLM Voting**: Majority-vote consensus mechanism using multiple LLMs (Claude, OpenAI, Gemini) for robust inclusion/exclusion decisions.
- Supports **Claude** (Anthropic), **OpenAI GPT**, and **Google Gemini** models.

### 📊 Analysis & Visualization
- **Overview Dashboard**: Summary statistics and progress indicators
- **Distribution Charts**: Bar charts, pie charts for facet frequencies
- **Trend Analysis**: Publication trends over time
- **Bubble Matrices**: Multi-dimensional facet analysis
- **Data Tables**: Exportable source-by-facet matrices
- **Drill-down**: Click any chart element to see underlying sources

### 🔌 Chrome Extension
- Works with ACM, IEEE, arXiv, Springer, ScienceDirect, Scopus
- Automatic metadata extraction (title, authors, abstract, DOI, venue)
- PDF download and upload when available
- Quick study selection for one-click source addition

---

## Architecture

```
aasms/
├── frontend/              # Next.js 14+ web application
│   ├── app/               # App Router pages & API routes
│   ├── components/        # React components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities & API clients
│   └── prisma/            # Database schema
├── python-service/        # FastAPI AI/ML service
│   └── src/
│       ├── api/routers/   # REST API endpoints
│       ├── core/          # LLM providers, prompts, schemas
│       └── services/      # Business logic
├── chrome-extension/      # Browser extension
│   ├── extractors/        # Site-specific metadata extractors
│   ├── popup/             # Extension UI
│   └── background/        # Service worker
└── docker-compose.yml     # Database & storage services
```

### Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16+, TypeScript, React 19, custom design with Tailwind CSS 4 |
| Backend API | Next.js API Routes (source management, study CRUD) |
| AI Service | Python FastAPI, Claude/OpenAI/Gemini APIs, asyncio |
| Database | PostgreSQL 16 (Prisma ORM) |
| File Storage | MinIO (S3-compatible) |
| Visualization | Apache ECharts |

---

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **Docker** and Docker Compose
- **uv** (Python package manager) - [Install uv](https://github.com/astral-sh/uv)
- **API Keys**: Anthropic Claude, OpenAI, and/or Google Gemini API keys

---

## Getting Started

### 1. Start Database & Storage Services

```bash
docker compose up -d
```

This starts:
- **PostgreSQL** on `localhost:5432` (user: `sms_user`, password: `sms_password`, db: `sms_db`)
- **MinIO** on `localhost:9000` (API) and `localhost:9001` (Console, user: `minioadmin`)

### 2. Setup Frontend

```bash
cd frontend
npm install

# Create .env file with the following content:
cat > .env << 'EOF'
DATABASE_URL="postgresql://sms_user:sms_password@localhost:5432/sms_db"
MINIO_ENDPOINT="localhost"
MINIO_PORT="9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_USE_SSL="false"
PYTHON_SERVICE_URL="http://localhost:8000"
EOF

# Initialize database
npx prisma generate
npx prisma db push

# Start development server
npm run dev
```

Frontend runs on **http://localhost:3000**

### 3. Setup Python Service

```bash
cd python-service
uv sync

# Create .env file with the following content:
cat > .env << 'EOF'
DATABASE_URL="postgresql://sms_user:sms_password@localhost:5432/sms_db"
ANTHROPIC_API_KEY="your-anthropic-key-here"
OPENAI_API_KEY="your-openai-key-here"
GOOGLE_API_KEY="your-google-key-here"
LLM_PROVIDER="claude"
EOF

# Start the service
uv run uvicorn src.main:app --reload --port 8000
```

Python service runs on **http://localhost:8000**

### 4. Install Chrome Extension (Optional)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `chrome-extension` directory

---

## Environment Variables

### Frontend `.env`

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://sms_user:sms_password@localhost:5432/sms_db` |
| `MINIO_ENDPOINT` | MinIO server hostname | `localhost` |
| `MINIO_PORT` | MinIO API port | `9000` |
| `MINIO_ACCESS_KEY` | MinIO access key | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO secret key | `minioadmin` |
| `MINIO_USE_SSL` | Enable SSL for MinIO | `false` |
| `PYTHON_SERVICE_URL` | Python AI service URL | `http://localhost:8000` |

### Python Service `.env`

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | - |
| `OPENAI_API_KEY` | OpenAI API key for GPT models | - |
| `GOOGLE_API_KEY` | Google API key for Gemini models | - |
| `LLM_PROVIDER` | LLM to use: `claude`, `openai`, `gemini`, or `auto` | `claude` |
| `GEMINI_MODEL` | Gemini model name | `gemini-1.5-pro-latest` |
| `GEMINI_SMALL_MODEL` | Gemini small model name | `gemini-1.5-flash-latest` |

---

## Project Structure Details

### Frontend (`/frontend`)

```
frontend/
├── app/
│   ├── api/studies/        # REST API routes for study CRUD
│   ├── studies/            # Study pages
│   │   ├── [id]/           # Study detail pages
│   │   │   ├── analysis/   # Analysis & visualization
│   │   │   ├── parameters/ # Study configuration
│   │   │   └── sources/    # Source management
│   │   └── new/            # Create new study
│   └── page.tsx            # Home page
├── components/
│   ├── analysis/           # Charts, tables, drilldowns
│   ├── facets/             # Facet configuration, coding wizard
│   ├── parameters/         # Criteria & schema editors
│   ├── source/             # Source cards, forms, tables
│   ├── study/              # Study-level components
│   └── ui/                 # shadcn/ui base components
├── hooks/                  # Custom React hooks
├── lib/                    # API clients, utilities
└── prisma/schema.prisma    # Database schema
```

### Python Service (`/python-service`)

```
python-service/src/
├── api/routers/
│   ├── analysis.py         # Source analysis endpoints
│   ├── coding.py           # Open coding endpoints
│   ├── imports.py          # Bulk import endpoints
│   ├── parsing.py          # PDF parsing endpoints
│   └── scraping.py         # Web scraping endpoints
├── core/
│   ├── llm_provider.py     # LLM abstraction layer
│   ├── prompts.py          # Prompt templates
│   └── schemas/            # JSON schemas for responses
└── services/
    ├── classification_service.py      # Facet classification
    ├── coding_service.py              # Open coding categories
    ├── document_parser.py             # PDF text extraction
    ├── inclusion_evaluation_service.py # Inclusion/exclusion
    ├── llm_client.py                  # LLM API client
    └── importers/                     # Database-specific importers
        ├── acm_importer.py
        ├── ieee_importer.py
        ├── scopus_importer.py
        └── duplicate_detector.py
```

### Chrome Extension (`/chrome-extension`)

```
chrome-extension/
├── extractors/             # Site-specific metadata extractors
│   ├── acm-extractor.js
│   ├── ieee-extractor.js
│   ├── arxiv-extractor.js
│   ├── springer-extractor.js
│   ├── sciencedirect-extractor.js
│   ├── scopus-extractor.js
│   └── generic-extractor.js
├── popup/                  # Extension popup UI
├── background/             # Service worker for API calls
├── content/                # Content scripts
└── manifest.json           # Extension configuration
```

---

## Data Model

### Core Entities

- **Study**: A systematic mapping study with title, description, research questions
- **Source**: A research paper or document with metadata and PDF
- **Facet**: A classification dimension (CLOSED, OPEN, or OPEN_CODED type)
- **FacetCategory**: Predefined or emergent categories for classification
- **Classification**: A source's assignment to a facet category
- **SourceAnalysis**: AI analysis results including inclusion/exclusion reasoning

### Classification Facet Types

| Type | Description |
|------|-------------|
| **CLOSED** | Must choose from predefined categories |
| **OPEN** | Free text / LLM-generated value |
| **OPEN_CODED** | Start as open, then cluster into categories via coding wizard |

---

## Workflow Overview

1. **Create Study**: Define research questions, title, and motivation
2. **Configure Parameters**: Set inclusion/exclusion criteria and classification schema
3. **Import Sources**: Bulk import from databases or add via Chrome extension
4. **AI Screening**: LLM evaluates each source against your criteria (can use multi-LLM voting)
5. **AI Classification**: LLM categorizes sources according to your facets
6. **Code Open Facets** (optional): use the **Coding Wizard** to refine and cluster open responses
7. **Analyze Results**: Explore visualizations, export data

---

## Documentation

- [Methodology Reference](docs/methodology.md) — SMS/MLR process summary (Petersen et al. 2015, Garousi et al. 2019)
- [Platform Workflows & Gap Analysis](docs/workflows.md) — maps methodology phases to platform features

## Current Limitations / Work in Progress

- [ ] Web scraping endpoint (stub exists, not implemented)
- [ ] Grey literature quality assessment
- [ ] Inter-rater reliability (Cohen's kappa) statistics
- [ ] PRISMA flow diagram visualization
- [ ] Multi-user collaboration
- [ ] Full-text search across sources
- [ ] Firefox extension support

---

## Development

### Running Tests

```bash
# Frontend
cd frontend && npm test

# Python service
cd python-service && uv run pytest
```

### Database Migrations

```bash
cd frontend
npx prisma migrate dev --name <migration-name>
```

### Resetting the Database

```bash
docker compose down -v
docker compose up -d
cd frontend && npx prisma db push
```

---

## License

License: PolyForm Noncommercial
https://polyformproject.org/licenses/noncommercial/1.0.0/
