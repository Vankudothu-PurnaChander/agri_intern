"""FastAPI Routes for Model Retraining and Operational Pipeline Monitoring.
Provides background retraining orchestration and model version auditing.
"""
import threading
from fastapi import APIRouter, BackgroundTasks, HTTPException
from datetime import datetime
from pathlib import Path
import json

from ml_service.config import ML_ARTIFACTS
from ml_service.services.training_service import TrainingService

router = APIRouter(prefix="/ml", tags=["ML Pipeline & Retraining"])

_retraining_state = {
    "is_retraining": False,
    "last_started": None,
    "last_completed": None,
    "last_status": "Idle",
    "error": None
}

def _run_retraining_job():
    global _retraining_state
    _retraining_state["is_retraining"] = True
    _retraining_state["last_started"] = datetime.now().isoformat()
    _retraining_state["last_status"] = "In Progress"
    try:
        ts = TrainingService(horizon_days=15)
        ts.train_all_crops()
        _retraining_state["last_completed"] = datetime.now().isoformat()
        _retraining_state["last_status"] = "Success"
        _retraining_state["error"] = None
    except Exception as e:
        _retraining_state["last_status"] = "Failed"
        _retraining_state["error"] = str(e)
    finally:
        _retraining_state["is_retraining"] = False

@router.post("/retrain")
def trigger_retraining(background_tasks: BackgroundTasks):
    """Triggers asynchronous model retraining across all crops."""
    global _retraining_state
    if _retraining_state["is_retraining"]:
        return {"status": "ALREADY_RUNNING", "message": "Retraining job is currently executing."}
        
    background_tasks.add_task(_run_retraining_job)
    return {
        "status": "ACCEPTED",
        "message": "Retraining job queued in background.",
        "triggered_at": datetime.now().isoformat()
    }

@router.get("/status")
def get_ml_status():
    """Retrieves operational status of trained model artifacts and versions."""
    eval_file = ML_ARTIFACTS / "evaluation" / "model_comparison.json"
    comp_data = {}
    if eval_file.exists():
        with open(eval_file, "r", encoding="utf-8") as f:
            comp_data = json.load(f)
            
    return {
        "operational_state": _retraining_state,
        "active_models_count": len(comp_data),
        "crops_deployed": list(comp_data.keys()),
        "models_summary": {
            cid: {
                "selected_model": info.get("best_model_name", "xgboost").upper(),
                "test_mae": info.get("selected_model_metrics", {}).get("mae"),
                "r2": info.get("selected_model_metrics", {}).get("r2"),
                "date": info.get("training_date")
            }
            for cid, info in comp_data.items()
        }
    }

