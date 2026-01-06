"""Main FastAPI application for SMS AI Service."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routers import analysis, parsing, scraping, imports, system
from src.core.config import settings
import logging

# Configure global logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

app = FastAPI(
    title="SMS AI Service",
    description="AI analysis service for Systematic Mapping Studies",
    version="0.1.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js frontend
        "chrome-extension://*"     # Chrome extension (any ID)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(analysis.router, prefix="/api")
app.include_router(parsing.router, prefix="/api")
app.include_router(scraping.router, prefix="/api")
app.include_router(imports.router, prefix="/api")
app.include_router(system.router, prefix="/api")


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "SMS AI Service",
        "version": "0.1.0",
        "llm_provider": settings.llm_provider,
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}

