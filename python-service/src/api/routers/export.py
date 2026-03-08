"""Export routes for generating study data exports."""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from pydantic.config import ConfigDict
from sqlalchemy.orm import Session
import logging

from src.core.database import SessionLocal
from src.services.export_service import ExportService

logger = logging.getLogger(__name__)

router = APIRouter()


class ExportRequest(BaseModel):
    """Request model for full export."""

    model_config = ConfigDict(populate_by_name=True)

    study_id: str = Field(..., alias="studyId")


def get_db() -> Session:
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/export/full")
def export_full_dataset(
    request: ExportRequest,
    db: Session = Depends(get_db),
):
    """
    Export the complete SMS dataset as a multi-sheet Excel workbook.

    Args:
        request: Export request with study_id
        db: Database session

    Returns:
        Excel file as binary stream
    """
    try:
        study_id = request.study_id

        # Validate study exists
        from sqlalchemy import text
        study_check = db.execute(
            text('SELECT id FROM "Study" WHERE id = :study_id'),
            {"study_id": study_id}
        ).fetchone()

        if not study_check:
            raise HTTPException(status_code=404, detail=f"Study {study_id} not found")

        # Generate export
        export_service = ExportService(db)
        excel_bytes = export_service.generate_full_export(study_id)

        # Return as file download
        return StreamingResponse(
            iter([excel_bytes]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="study-export.xlsx"'
            }
        )

    except ValueError as e:
        logger.warning(f"Export validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("export-full: failed")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
