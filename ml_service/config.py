"""Centralized Configuration for Warangal District Agriculture Market Intelligence System.
Defines canonical crop configurations, market registries, paths, and business rules.
"""
import os
from pathlib import Path

# Base Paths
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATASETS_RAW = PROJECT_ROOT / "Datasets"
DATASETS_PROCESSED = PROJECT_ROOT / "datasets" / "processed"
DATASETS_REPORTS = PROJECT_ROOT / "datasets" / "reports"
ML_ARTIFACTS = PROJECT_ROOT / "ml_service" / "artifacts"

# Target Geography
TARGET_DISTRICT = "Warangal"
TARGET_STATE = "Telangana"
TIMEZONE = "Asia/Kolkata"

# The 7 Supported Crops
CROPS = {
    "cotton": {
        "crop_id": "cotton",
        "canonical_name": "Cotton",
        "display_name_en": "Cotton",
        "display_name_te": "పత్తి",
        "agmarknet_codes": [15],
        "hs_codes": ["5201"],
        "price_unit": "₹/Quintal",
        "arrival_unit": "Tonnes",
        "standard_grade": "FAQ",
        "image_path": "/crops/cotton.png",
        "price_range_bounds": (1000, 20000),  # Sanity bounds in ₹/Qtl
        "arrival_range_bounds": (0, 100000),  # Tonnes
        "aliases": ["cotton", "kapas", "cotton (raw)", "bramha", "dch", "cotton lint"]
    },
    "dry_chillies": {
        "crop_id": "dry_chillies",
        "canonical_name": "Dry Chillies",
        "display_name_en": "Dry Chillies",
        "display_name_te": "ఎండు మిర్చి",
        "agmarknet_codes": [113, 132],
        "hs_codes": ["090421", "090420", "0904"],
        "price_unit": "₹/Quintal",
        "arrival_unit": "Tonnes",
        "standard_grade": "FAQ",
        "image_path": "/crops/dry_chillies.png",
        "price_range_bounds": (2000, 50000),
        "arrival_range_bounds": (0, 100000),
        "aliases": ["dry chillies", "dry chilli", "red chilli", "red chillies", "chilli (dry)", "chillies (dry)", "dry chillis", "1st sort"]
    },
    "maize": {
        "crop_id": "maize",
        "canonical_name": "Maize",
        "display_name_en": "Maize",
        "display_name_te": "మొక్కజొన్న",
        "agmarknet_codes": [4],
        "hs_codes": ["100590", "1005"],
        "price_unit": "₹/Quintal",
        "arrival_unit": "Tonnes",
        "standard_grade": "FAQ",
        "image_path": "/crops/maize.png",
        "price_range_bounds": (800, 10000),
        "arrival_range_bounds": (0, 100000),
        "aliases": ["maize", "corn", "makka", "yellow maize"]
    },
    "turmeric": {
        "crop_id": "turmeric",
        "canonical_name": "Turmeric",
        "display_name_en": "Turmeric",
        "display_name_te": "పసుపు",
        "agmarknet_codes": [35],
        "hs_codes": ["091030", "0910"],
        "price_unit": "₹/Quintal",
        "arrival_unit": "Tonnes",
        "standard_grade": "FAQ",
        "image_path": "/crops/turmeric.png",
        "price_range_bounds": (2000, 30000),
        "arrival_range_bounds": (0, 100000),
        "aliases": ["turmeric", "haldi", "pasupu", "turmeric (finger)", "turmeric (bulb)", "turmeric(finger)", "turmeric(bulb)"]
    },
    "groundnut": {
        "crop_id": "groundnut",
        "canonical_name": "Groundnut",
        "display_name_en": "Groundnut",
        "display_name_te": "వేరుశనగ",
        "agmarknet_codes": [10],
        "hs_codes": ["120242", "1202"],
        "price_unit": "₹/Quintal",
        "arrival_unit": "Tonnes",
        "standard_grade": "FAQ",
        "image_path": "/crops/groundnut.png",
        "price_range_bounds": (1500, 15000),
        "arrival_range_bounds": (0, 100000),
        "aliases": ["groundnut", "peanut", "groundnut (split)", "palli"]
    },
    "paddy": {
        "crop_id": "paddy",
        "canonical_name": "Paddy",
        "display_name_en": "Paddy",
        "display_name_te": "వరి (వడ్లు)",
        "agmarknet_codes": [2],
        "hs_codes": ["100610", "1006"],
        "price_unit": "₹/Quintal",
        "arrival_unit": "Tonnes",
        "standard_grade": "FAQ",
        "image_path": "/crops/paddy.png",
        "price_range_bounds": (1000, 8000),
        "arrival_range_bounds": (0, 100000),
        "aliases": ["paddy", "paddy(common)", "paddy(dhan)", "bpt", "rice(paddy)"]
    },
    "red_gram": {
        "crop_id": "red_gram",
        "canonical_name": "Red Gram",
        "display_name_en": "Red Gram",
        "display_name_te": "కందులు",
        "agmarknet_codes": [45],
        "hs_codes": ["071360", "0713"],
        "price_unit": "₹/Quintal",
        "arrival_unit": "Tonnes",
        "standard_grade": "FAQ",
        "image_path": "/crops/red_gram.png",
        "price_range_bounds": (2000, 20000),
        "arrival_range_bounds": (0, 100000),
        "aliases": ["red gram", "arhar", "tur", "red gram/arhar/tur(whole)", "pigeon pea", "kandi"]
    }
}

# Verified Warangal District Markets Registry & Canonical Mapping
WARANGAL_MARKETS = {
    "Warangal": "Warangal APMC",
    "Warangal APMC": "Warangal APMC",
    "Kesamudram": "Kesamudram APMC",
    "Kesamudram APMC": "Kesamudram APMC",
    "Jangaon": "Jangaon APMC",
    "Jangaon APMC": "Jangaon APMC",
    "Mahabubabad": "Mahabubabad APMC",
    "Mahabubabad APMC": "Mahabubabad APMC",
    "Narsampet": "Narsampet APMC",
    "Narsampet APMC": "Narsampet APMC",
    "Narsampet(Nekonda)": "Nekkonda APMC",
    "Nekkonda APMC": "Nekkonda APMC",
    "Mulugu": "Mulugu APMC",
    "Mulugu APMC": "Mulugu APMC",
    "Wardhannapet": "Wardhannapet APMC",
    "Wardhannapet APMC": "Wardhannapet APMC",
    "Ghanpur": "Station Ghanpur",
    "Station Ghanpur": "Station Ghanpur",
    "Thorrur": "Thorrur APMC",
    "Thorrur APMC": "Thorrur APMC",
    "Parkal": "Parkal APMC",
    "Parkal APMC": "Parkal APMC",
    "Cherial APMC": "Cherial APMC",
    "Kodakandal": "Kodakandal"
}

def resolve_crop_id(name_or_code):
    """Maps any crop alias, code, or variation to canonical crop_id with strict exclusions."""
    if not name_or_code:
        return None
    s = str(name_or_code).strip().lower()

    # Explicit exclusions for distinct commodities & vegetables
    if "green chilli" in s or "green chili" in s or "green chilly" in s:
        return None
    if "bhindi" in s or "ladies finger" in s or "okra" in s:
        return None
    if any(other in s for other in ["green gram", "moong", "black gram", "urad", "bengal gram", "chana"]):
        return None

    # 1. Exact canonical or crop_id match
    for crop_id, meta in CROPS.items():
        if s == crop_id.lower() or s == meta["canonical_name"].lower():
            return crop_id

    # 2. Exact code match
    for crop_id, meta in CROPS.items():
        for code in meta.get("agmarknet_codes", []):
            if str(code) == s:
                return crop_id

    # 3. Alias substring match (only if alias is at least 3 chars and is contained in input string)
    for crop_id, meta in CROPS.items():
        for alias in meta["aliases"]:
            if len(alias) >= 3 and alias.lower() in s:
                return crop_id

    return None

def resolve_market(raw_market_name):
    """Resolves raw market string to canonical APMC name."""
    if not raw_market_name:
        return None
    raw_clean = str(raw_market_name).strip()
    return WARANGAL_MARKETS.get(raw_clean, raw_clean)

