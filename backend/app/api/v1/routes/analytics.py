import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db
from app.api.deps import require_manager_or_admin, require_admin
from app.core.logging import get_logger
from app.services.langgraph.agents import ag_12_analytics, ag_17_data_consent

logger = get_logger(__name__)
router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/reports")
async def get_analytics_reports(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_manager_or_admin)
):
    """
    Generate SLA compliance and Sentiment statistics.
    (AG-12 execution)
    """
    try:
        report_data = await ag_12_analytics(db)
        
        # Add some mock heat map data for Voice of Customer (UI-08) 
        # since we don't have a real time-series DB set up
        heatmap_data = [
            {"day": "Mon", "positive": random.randint(10, 50), "neutral": random.randint(20, 80), "negative": random.randint(5, 30), "angry": random.randint(0, 10)},
            {"day": "Tue", "positive": random.randint(10, 50), "neutral": random.randint(20, 80), "negative": random.randint(5, 30), "angry": random.randint(0, 10)},
            {"day": "Wed", "positive": random.randint(10, 50), "neutral": random.randint(20, 80), "negative": random.randint(5, 30), "angry": random.randint(0, 10)},
            {"day": "Thu", "positive": random.randint(10, 50), "neutral": random.randint(20, 80), "negative": random.randint(5, 30), "angry": random.randint(0, 10)},
            {"day": "Fri", "positive": random.randint(10, 50), "neutral": random.randint(20, 80), "negative": random.randint(5, 30), "angry": random.randint(0, 10)},
            {"day": "Sat", "positive": random.randint(5, 20), "neutral": random.randint(10, 40), "negative": random.randint(0, 15), "angry": random.randint(0, 5)},
            {"day": "Sun", "positive": random.randint(5, 20), "neutral": random.randint(10, 40), "negative": random.randint(0, 15), "angry": random.randint(0, 5)},
        ]
        
        report_data["voc_heatmap"] = heatmap_data
        
        return {
            "status": "success",
            "data": report_data
        }
    except Exception as e:
        logger.error(f"Failed to generate analytics report: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate analytics report.")


@router.post("/sweep")
async def trigger_data_consent_sweep(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_admin)
):
    """
    Trigger the 7-year data retention sweep manually.
    (AG-17 execution)
    """
    try:
        result = await ag_17_data_consent(db)
        return {
            "status": "success",
            "message": "Data consent sweep executed successfully.",
            "details": result
        }
    except Exception as e:
        logger.error(f"Failed to execute data consent sweep: {e}")
        raise HTTPException(status_code=500, detail="Failed to execute data consent sweep.")
