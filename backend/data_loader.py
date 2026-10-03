import io
import os
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler

from database import db

# ── Default (hardcoded) dataset path ──────────────────────────────────────────
# Absolute, so it resolves correctly regardless of the process's working directory.
CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Mall_Customers.csv")

# ── In-memory uploaded dataset store ─────────────────────────────────────────
# When a user uploads a CSV this dict is populated.
# { "df": pd.DataFrame, "col_map": {...}, "filename": str, "row_count": int }
_uploaded: dict = {}
_uploads_col = db["uploads"]


def _load_from_mongo():
    """Restore the active upload from MongoDB after a cold start (in-memory cache is empty)."""
    global _uploaded
    doc = _uploads_col.find_one()
    if not doc:
        return
    df = pd.read_csv(io.BytesIO(doc["csv_bytes"]))
    _uploaded = {
        "df":        df,
        "col_map":   doc["col_map"],
        "filename":  doc["filename"],
        "row_count": len(df),
    }


def has_upload() -> bool:
    return bool(_uploaded)


def get_upload_info() -> dict:
    if not _uploaded:
        _load_from_mongo()
    if not _uploaded:
        return {}
    return {
        "filename":  _uploaded.get("filename", ""),
        "row_count": _uploaded.get("row_count", 0),
        "col_map":   _uploaded.get("col_map", {}),
    }


def store_upload(df: pd.DataFrame, col_map: dict, filename: str):
    """Persist an uploaded dataframe + column mapping to MongoDB and memory."""
    global _uploaded

    # Serialise DataFrame to CSV bytes for MongoDB storage
    buf = io.BytesIO()
    df.to_csv(buf, index=False)
    csv_bytes = buf.getvalue()

    # Upsert a single document (we only ever keep one active upload)
    _uploads_col.delete_many({})
    _uploads_col.insert_one({
        "csv_bytes": csv_bytes,
        "col_map":   col_map,
        "filename":  filename,
    })

    # Update in-memory cache
    _uploaded = {
        "df":        df,
        "col_map":   col_map,
        "filename":  filename,
        "row_count": len(df),
    }

    import model as _m
    _m.reset_cache()


def clear_upload():
    global _uploaded
    _uploads_col.delete_many({})
    _uploaded.clear()
    import model as _m
    _m.reset_cache()


# ── Load data (uploaded takes priority over hardcoded) ────────────────────────
def load_data() -> pd.DataFrame:
    if not _uploaded:
        _load_from_mongo()

    if _uploaded:
        df = _uploaded["df"].copy()
        cm = _uploaded["col_map"]

        # Normalise column names to the standard set
        rename = {}
        if cm.get("id"):       rename[cm["id"]]       = "CustomerID"
        if cm.get("gender"):   rename[cm["gender"]]   = "Gender"
        if cm.get("age"):      rename[cm["age"]]       = "Age"
        if cm.get("income"):   rename[cm["income"]]   = "AnnualIncome"
        if cm.get("spending"): rename[cm["spending"]] = "SpendingScore"
        df = df.rename(columns=rename)

        # FIX: guarantee every expected column exists so downstream code
        # never hits a KeyError regardless of what the user mapped.
        if "Gender" not in df.columns:
            df["Gender"] = "Unknown"
        if "CustomerID" not in df.columns:
            df["CustomerID"] = range(1, len(df) + 1)
        if "Age" not in df.columns:
            # Use a neutral default (median-like) so cluster stats don't crash
            df["Age"] = 30

        return df
    else:
        df = pd.read_csv(CSV_PATH)
        df.columns = ["CustomerID", "Gender", "Age", "AnnualIncome", "SpendingScore"]
        return df


# ── Pre-process for K-Means ───────────────────────────────────────────────────
# Only AnnualIncome + SpendingScore are used for clustering.
# Age and Gender are kept in the DataFrame for display purposes only.
def preprocess(df: pd.DataFrame):
    df = df.copy()

    # FIX: validate required columns exist before trying to use them
    missing = [c for c in ["AnnualIncome", "SpendingScore"] if c not in df.columns]
    if missing:
        raise ValueError(
            f"Dataset is missing required columns after mapping: {missing}. "
            "Please re-upload and map the income and spending columns correctly."
        )

    features = df[["AnnualIncome", "SpendingScore"]].values.astype(float)
    scaler = StandardScaler()
    scaled = scaler.fit_transform(features)
    return df, scaled, scaler


# ── Churn risk from cluster stats ─────────────────────────────────────────────
def assign_churn_risk(cluster_id: int, cluster_stats: dict) -> dict:
    stats = cluster_stats[cluster_id]
    spending = stats["avg_spending"]

    if spending < 35:
        return {"risk": "High Risk",   "level": 3, "color": "#EF4444", "badge": "🔴"}
    elif spending < 60:
        return {"risk": "Medium Risk", "level": 2, "color": "#F59E0B", "badge": "🟡"}
    else:
        return {"risk": "Low Risk",    "level": 1, "color": "#10B981", "badge": "🟢"}
