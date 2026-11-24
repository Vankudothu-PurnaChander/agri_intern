"""Validation and Quality Assurance Module.
Detects statistical outliers, checks logical bounds, and logs rejected records.
"""
import numpy as np
import pandas as pd
from datetime import datetime
from ml_service.config import CROPS

class DataValidator:
    def __init__(self):
        self.rejected_records = []
        
    def log_rejection(self, record_dict, reason, dataset_category):
        entry = dict(record_dict)
        entry["rejection_reason"] = reason
        entry["dataset_category"] = dataset_category
        entry["rejected_at"] = datetime.now().isoformat()
        self.rejected_records.append(entry)
        
    def validate_price_row(self, row, crop_id):
        """Validates a single price record against business logic and sanity ranges.
        Returns: (is_valid, reason, cleaned_row)
        """
        min_p = row.get("min_price")
        max_p = row.get("max_price")
        mod_p = row.get("modal_price")
        
        # Check nulls or non-numeric
        for val, name in [(min_p, "min_price"), (max_p, "max_price"), (mod_p, "modal_price")]:
            if pd.isna(val) or val is None:
                return False, f"Missing {name}", row
            try:
                float(val)
            except (ValueError, TypeError):
                return False, f"Non-numeric {name}: {val}", row
                
        min_p = float(min_p)
        max_p = float(max_p)
        mod_p = float(mod_p)
        
        # Non-positive values
        if min_p <= 0 or max_p <= 0 or mod_p <= 0:
            return False, f"Non-positive price: Min={min_p}, Modal={mod_p}, Max={max_p}", row
            
        # Logical price relationship: min <= modal <= max
        if min_p > max_p:
            # Check if inverted min/max
            if min_p <= 2 * max_p:
                min_p, max_p = max_p, min_p
            else:
                return False, f"Severe price contradiction: Min({min_p}) > Max({max_p})", row
                
        if mod_p < min_p:
            # If slightly lower, adjust min to modal or vice versa
            if (min_p - mod_p) / min_p < 0.15:
                min_p = mod_p
            else:
                return False, f"Modal price ({mod_p}) substantially lower than Min ({min_p})", row
                
        if mod_p > max_p:
            if (mod_p - max_p) / max_p < 0.15:
                max_p = mod_p
            else:
                return False, f"Modal price ({mod_p}) substantially higher than Max ({max_p})", row
                
        # Check against physical plausible crop bounds
        if crop_id in CROPS:
            low_bound, high_bound = CROPS[crop_id]["price_range_bounds"]
            if mod_p < low_bound or mod_p > high_bound:
                return False, f"Modal price {mod_p} outside plausible range [{low_bound}, {high_bound}] for {crop_id}", row
                
        cleaned_row = dict(row)
        cleaned_row["min_price"] = min_p
        cleaned_row["max_price"] = max_p
        cleaned_row["modal_price"] = mod_p
        return True, "Valid", cleaned_row

    def get_rejected_dataframe(self):
        if not self.rejected_records:
            return pd.DataFrame(columns=["dataset_category", "rejection_reason", "rejected_at"])
        return pd.DataFrame(self.rejected_records)

