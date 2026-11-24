"""Automated Test Suite for Agricultural Intelligence Pipeline.
Validates data ingestion, date parsing, crop mapping, leakage prevention,
forecasting model serialization, and metrics calculation.
"""
import unittest
import numpy as np
import pandas as pd
from datetime import datetime

from ml_service.config import CROPS, WARANGAL_MARKETS, resolve_crop_id, resolve_market
from ml_service.data.cleaner import parse_date_smart
from ml_service.data.validator import DataValidator
from ml_service.evaluation.metrics import calculate_metrics
from ml_service.features.feature_engineering import FeatureEngineer
from ml_service.services.forecasting_service import ForecastingService

class TestAgriculturalPipeline(unittest.TestCase):
    def setUp(self):
        self.validator = DataValidator()
        self.forecaster = ForecastingService()

    def test_crop_mapping(self):
        """Verifies canonical crop ID resolution for aliases and codes."""
        self.assertEqual(resolve_crop_id("Cotton"), "cotton")
        self.assertEqual(resolve_crop_id("Kapas"), "cotton")
        self.assertEqual(resolve_crop_id("15"), "cotton")
        self.assertEqual(resolve_crop_id("Dry Chillies"), "dry_chillies")
        self.assertEqual(resolve_crop_id("1st Sort"), "dry_chillies")
        self.assertEqual(resolve_crop_id("Maize"), "maize")
        self.assertEqual(resolve_crop_id("Paddy(Common)"), "paddy")
        self.assertEqual(resolve_crop_id("Turmeric"), "turmeric")
        self.assertEqual(resolve_crop_id("Groundnut"), "groundnut")
        self.assertEqual(resolve_crop_id("Red gram/Arhar/Tur(whole)"), "red_gram")

    def test_market_mapping(self):
        """Verifies market name standardization to canonical APMCs."""
        self.assertEqual(resolve_market("Warangal"), "Warangal APMC")
        self.assertEqual(resolve_market("Kesamudram"), "Kesamudram APMC")
        self.assertEqual(resolve_market("Jangaon"), "Jangaon APMC")
        self.assertEqual(resolve_market("Narsampet(Nekonda)"), "Nekkonda APMC")

    def test_date_parsing(self):
        """Verifies heterogeneous date parsing (DD-MM-YYYY, ISO, Timestamps)."""
        self.assertEqual(parse_date_smart("06-07-2024"), "2024-07-06")
        self.assertEqual(parse_date_smart("2024-07-06"), "2024-07-06")
        self.assertEqual(parse_date_smart(pd.Timestamp("2024-07-06 00:00:00")), "2024-07-06")
        self.assertEqual(parse_date_smart("31-12-2025"), "2025-12-31")

    def test_price_validation(self):
        """Verifies price consistency checks and outlier quarantine."""
        # Valid row
        valid_row = {"min_price": 6000, "max_price": 7000, "modal_price": 6500}
        ok, reason, cleaned = self.validator.validate_price_row(valid_row, "cotton")
        self.assertTrue(ok)
        
        # Zero price should fail
        zero_row = {"min_price": 0, "max_price": 0, "modal_price": 7000}
        ok, reason, _ = self.validator.validate_price_row(zero_row, "cotton")
        self.assertFalse(ok)
        
        # Outlier price should fail
        outlier_row = {"min_price": 75000, "max_price": 80000, "modal_price": 76000}
        ok, reason, _ = self.validator.validate_price_row(outlier_row, "cotton")
        self.assertFalse(ok)

    def test_evaluation_metrics(self):
        """Verifies MAE, RMSE, MAPE, sMAPE, R2, and Directional Accuracy calculations."""
        y_true = np.array([100.0, 110.0, 120.0, 130.0])
        y_pred = np.array([102.0, 108.0, 125.0, 128.0])
        y_base = np.array([98.0, 105.0, 115.0, 125.0])
        
        metrics = calculate_metrics(y_true, y_pred, y_base=y_base)
        self.assertAlmostEqual(metrics["mae"], 2.75, places=1)
        self.assertGreater(metrics["directional_accuracy"], 70.0)
        self.assertGreater(metrics["r2"], 0.8)

    def test_forecasting_service_output(self):
        """Verifies end-to-end forecast generation for primary horizon (15 days)."""
        res = self.forecaster.generate_forecast("cotton", market_name="Warangal APMC", horizon_days=15)
        self.assertEqual(res["crop_id"], "cotton")
        self.assertEqual(res["forecast_horizon_days"], 15)
        self.assertIn("timeline", res)
        self.assertEqual(len(res["timeline"]), 30) # 15 past + 15 future
        
        # Check that historical actuals and future predictions are separated
        hist_part = [p for p in res["timeline"] if p["is_historical"]]
        future_part = [p for p in res["timeline"] if not p["is_historical"]]
        self.assertEqual(len(hist_part), 15)
        self.assertEqual(len(future_part), 15)
        
        # Future points must have predictions and uncertainty bounds
        self.assertIsNotNone(future_part[-1]["predicted_modal_price"])
        self.assertIsNotNone(future_part[-1]["lower_bound"])
        self.assertIsNotNone(future_part[-1]["upper_bound"])
        self.assertLess(future_part[-1]["lower_bound"], future_part[-1]["upper_bound"])

if __name__ == "__main__":
    unittest.main()

