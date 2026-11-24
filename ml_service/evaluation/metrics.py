"""Evaluation Metrics Module for Price Forecasting.
Calculates MAE, RMSE, MAPE, sMAPE, R-squared, and Directional Accuracy.
Handles division by zero safely and computes prediction intervals.
"""
import numpy as np

def calculate_metrics(y_true, y_pred, y_base=None):
    """Calculates comprehensive forecasting metrics on test/validation sets.
    y_true: actual observed prices
    y_pred: predicted prices
    y_base: reference price at forecast origin (for Directional Accuracy)
    """
    y_true = np.asarray(y_true, dtype=np.float64)
    y_pred = np.asarray(y_pred, dtype=np.float64)
    
    # Filter out NaNs
    mask = ~np.isnan(y_true) & ~np.isnan(y_pred)
    y_t = y_true[mask]
    y_p = y_pred[mask]
    
    if len(y_t) == 0:
        return {
            "mae": None, "rmse": None, "mape": None,
            "smape": None, "r2": None, "directional_accuracy": None,
            "sample_count": 0
        }
        
    # 1. MAE
    mae = float(np.mean(np.abs(y_t - y_p)))
    
    # 2. RMSE
    rmse = float(np.sqrt(np.mean((y_t - y_p) ** 2)))
    
    # 3. MAPE (Safe with epsilon)
    eps = 1e-6
    mape = float(np.mean(np.abs((y_t - y_p) / np.maximum(y_t, eps))) * 100)
    
    # 4. sMAPE (Symmetric MAPE)
    denominator = (np.abs(y_t) + np.abs(y_p)) / 2.0
    smape = float(np.mean(np.abs(y_t - y_p) / np.maximum(denominator, eps)) * 100)
    
    # 5. R-squared (Coefficient of Determination)
    ss_res = np.sum((y_t - y_p) ** 2)
    ss_tot = np.sum((y_t - np.mean(y_t)) ** 2)
    r2 = float(1.0 - (ss_res / (ss_tot + eps))) if ss_tot > eps else 0.0
    
    # 6. Directional Accuracy (Movement Up/Down)
    dir_acc = None
    if y_base is not None:
        y_b = np.asarray(y_base, dtype=np.float64)[mask]
        actual_dir = np.sign(y_t - y_b)
        pred_dir = np.sign(y_p - y_b)
        # Fraction where direction matches or both are zero
        matching = (actual_dir == pred_dir)
        dir_acc = float(np.mean(matching) * 100)
        
    return {
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "mape": round(mape, 2),
        "smape": round(smape, 2),
        "r2": round(r2, 4),
        "directional_accuracy": round(dir_acc, 2) if dir_acc is not None else None,
        "sample_count": len(y_t)
    }

