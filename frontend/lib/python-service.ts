/**
 * Shared constant for the Python service URL.
 * Used by all API routes that communicate with the FastAPI backend.
 */
export const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
