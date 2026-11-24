"""FastAPI Routes for Statistical Analysis and Price-Arrival Dynamics.
Exposes Pearson, Spearman, Lagged correlations, and continuous rolling associations.
"""
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from ml_service.config import CROPS, DATASETS_PROCESSED
from ml_service.analysis.correlation import StatisticalAnalyzer

router = APIRouter(prefix="/analysis", tags=["Statistical Analysis"])
analyzer = StatisticalAnalyzer()

@router.get("/correlation")
def get_all_correlations():
    """Returns stored correlation analysis results across all crops and mandis."""
    json_path = DATASETS_PROCESSED / "integrated" / "correlation_results.json"
    if json_path.exists():
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return analyzer.run_all_analyses()

@router.get("/price-arrival/{crop_id}")
def get_price_arrival_analysis(
    crop_id: str,
    market_name: Optional[str] = Query(None)
):
    """Returns granular price-arrival paired time series and correlation for a crop."""
    cid = crop_id.lower().replace("-", "_")
    if cid not in CROPS:
        raise HTTPException(status_code=404, detail=f"Unsupported crop: '{crop_id}'")
        
    res = analyzer.analyze_crop_market(cid, market_name=market_name)
    return res

@router.get("/lag-analysis/{crop_id}")
def get_lag_analysis(
    crop_id: str,
    market_name: Optional[str] = Query(None)
):
    """Evaluates cross-correlation across 0, 1, 3, 7, and 15 day lags."""
    cid = crop_id.lower().replace("-", "_")
    if cid not in CROPS:
        raise HTTPException(status_code=404, detail=f"Unsupported crop: '{crop_id}'")
        
    res = analyzer.analyze_crop_market(cid, market_name=market_name)
    return {
        "crop_id": cid,
        "market_name": market_name or "Warangal District Aggregate",
        "lagged_correlations": res.get("lagged_correlations", {}),
        "selected_lag": res.get("selected_lag", 0),
        "interpretation": res.get("interpretation")
    }

