"""Safe and robust file loader for agricultural datasets.
Handles Excel locks gracefully, supports .csv.gz natively, and tracks provenance.
"""
import os
import shutil
import tempfile
import pandas as pd
from pathlib import Path

def safe_read_file(file_path, **kwargs):
    """Safely reads a CSV, XLSX, or CSV.GZ file into a pandas DataFrame.
    If an Excel or CSV file is locked by another process (e.g. MS Excel),
    a temporary snapshot copy is read instead.
    """
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
        
    ext = file_path.suffix.lower()
    
    if ext == ".csv":
        try:
            return pd.read_csv(file_path, **kwargs)
        except PermissionError:
            with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
                tmp_path = Path(tmp.name)
            try:
                shutil.copy2(file_path, tmp_path)
                return pd.read_csv(tmp_path, **kwargs)
            finally:
                if tmp_path.exists():
                    tmp_path.unlink()
                    
    elif ext in [".xlsx", ".xls"]:
        try:
            return pd.read_excel(file_path, **kwargs)
        except PermissionError:
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                tmp_path = Path(tmp.name)
            try:
                shutil.copy2(file_path, tmp_path)
                return pd.read_excel(tmp_path, **kwargs)
            finally:
                if tmp_path.exists():
                    tmp_path.unlink()
                    
    elif ext == ".gz" or str(file_path).endswith(".csv.gz"):
        return pd.read_csv(file_path, compression="gzip", **kwargs)
        
    else:
        raise ValueError(f"Unsupported file format: {file_path}")

