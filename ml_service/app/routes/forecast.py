"""FastAPI Routes for Crop Price Forecasting.
Exposes multi-horizon predictions, continuous timelines, and evaluation benchmarks.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from ml_service.config import CROPS
from ml_service.services.forecasting_service import ForecastingService

router = APIRouter(prefix="/forecast", tags=["Forecasting"])
forecaster = ForecastingService()

@router.get("/support/table")
def get_support_table():
    """Crop-market combinations with real observation counts and support status."""
    return {"rows": forecaster.fe.support_table(),
            "min_observations": forecaster.fe.MIN_OBSERVATIONS}

@router.get("/{crop_id}")
def get_crop_forecast(
    crop_id: str,
    market_name: Optional[str] = Query(None, description="Canonical APMC market name"),
    horizon_days: int = Query(15, ge=1, le=90, description="Forecast horizon in calendar days")
):
    """Retrieves 15-day continuous actual-plus-forecast timeline for the specified crop and market."""
    cid = crop_id.lower().replace("-", "_")
    if cid not in CROPS:
        raise HTTPException(status_code=404, detail=f"Unsupported crop: '{crop_id}'. Supported: {list(CROPS.keys())}")
        
    try:
        result = forecaster.generate_forecast(cid, market_name=market_name, horizon_days=horizon_days)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{crop_id}/horizons")
def get_multi_horizon_forecast(
    crop_id: str,
    market_name: Optional[str] = Query(None)
):
    """Retrieves forecasts across all 3 key horizons: 7, 15, and 30 days."""
    cid = crop_id.lower().replace("-", "_")
    if cid not in CROPS:
        raise HTTPException(status_code=404, detail=f"Unsupported crop: '{crop_id}'")
        
    horizons = [7, 15, 30]
    results = {}
    for h in horizons:
        try:
            fc = forecaster.generate_forecast(cid, market_name=market_name, horizon_days=h)
            results[f"{h}_days"] = {
                "predicted_price": fc.get("forecast_final_price"),
                "expected_change_pct": fc.get("expected_change_pct"),
                "trend": fc.get("trend_direction"),
                "uncertainty_range": [
                    fc["timeline"][-1]["lower_bound"] if fc.get("timeline") else None,
                    fc["timeline"][-1]["upper_bound"] if fc.get("timeline") else None
                ]
            }
        except Exception:
            results[f"{h}_days"] = None
            
    return {
        "crop_id": cid,
        "crop_name": CROPS[cid]["canonical_name"],
        "horizons": results
    }

@router.get("/{crop_id}/evaluation")
def get_crop_evaluation(crop_id: str):
    """Returns model comparison and validation metrics for the crop."""
    cid = crop_id.lower().replace("-", "_")
    best_name, metrics = forecaster._get_best_model_info(cid)
    return {
        "crop_id": cid,
        "crop_name": CROPS.get(cid, {}).get("canonical_name", cid),
        "selected_model": best_name.upper(),
        "metrics": metrics
    }

