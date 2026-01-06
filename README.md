# SMS Assistant - Systematic Mapping Studies AI Assistant

An AI-powered assistant for conducting Systematic Mapping Studies in software engineering research.

## Architecture

- **Frontend**: Next.js 14+ (App Router) + TypeScript + shadcn/ui + Tailwind CSS
- **Backend**: Next.js API routes + Python FastAPI service (AI analysis)
- **Database**: PostgreSQL (via Docker)
- **Storage**: MinIO (S3-compatible, via Docker)

## Features

- **Study Management**: Create and manage systematic mapping studies
- **Source Management**: Upload PDFs, add URLs, import bulk database exports
- **Bulk Import**: Import from IEEE Xplore, ACM Digital Library, SCOPUS (see [BULK_IMPORT.md](BULK_IMPORT.md))
- **AI Analysis**: Automated relevance checking and classification
- **Duplicate Detection**: Automatic detection across multiple databases
- **Chrome Extension**: Extract metadata from academic databases (see [chrome-extension/README.md](chrome-extension/README.md))

## Prerequisites

- Node.js 18+ and npm/pnpm
- Python 3.11+
- Docker and Docker Compose
- uv (Python package manager)

## Getting Started

### 1. Start Infrastructure

```bash
docker compose up -d
```

This starts:
- PostgreSQL on `localhost:5432`
- MinIO on `localhost:9000` (API) and `localhost:9001` (Console)

### 2. Setup Frontend

```bash
cd frontend
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

Frontend runs on `http://localhost:3000`

### 3. Setup Python Service

```bash
cd python-service
cp .env.example .env
uv sync
uv run uvicorn src.main:app --reload --port 8000
```

Python service runs on `http://localhost:8000`

## Environment Variables

### Frontend `.env`

```
DATABASE_URL="postgresql://sms_user:sms_password@localhost:5432/sms_db"
MINIO_ENDPOINT="localhost"
MINIO_PORT="9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_USE_SSL="false"
PYTHON_SERVICE_URL="http://localhost:8000"
```

### Python Service `.env`

```
DATABASE_URL="postgresql://sms_user:sms_password@localhost:5432/sms_db"
ANTHROPIC_API_KEY="your-key-here"
OPENAI_API_KEY="your-key-here"
LLM_PROVIDER="claude"  # or "openai"
```

## Project Structure

```
sms-assistant/
├── docker-compose.yml
├── frontend/              # Next.js application
└── python-service/        # FastAPI service
```

## License

MIT

