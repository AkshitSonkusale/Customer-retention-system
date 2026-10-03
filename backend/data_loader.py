import io
import os
from datetime import datetime, timezone

import pandas as pd
from bson import ObjectId
from sklearn.preprocessing import StandardScaler

from database import db, users_collection

# ── Default (hardcoded) dataset path ──────────────────────────────────────────
# Absolute, so it resolves correctly regardless of the process's working directory.
CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Mall_Customers.csv")

RISK_HIGH_BELOW = 35
RISK_MEDIUM_BELOW = 60

_uploads_col = db["uploads"]
_parsed: dict = {}  # upload id -> parsed upload


def _parse(doc):
    df = pd.read_csv(io.BytesIO(doc["csv_bytes"]))
    return {
        "id":          str(doc["_id"]),
        "df":          df,
        "col_map":     doc["col_map"],
        "filename":    doc["filename"],
        "row_count":   len(df),
        "uploaded_at": doc["uploaded_at"],
    }


def active_upload_id(email):
    user = users_collection.find_one({"email": email}, {"active_upload_id": 1})
    return user.get("active_upload_id") if user else None


def get_upload(email, upload_id):
    if upload_id not in _parsed:
        doc = _uploads_col.find_one({"_id": ObjectId(upload_id), "user_email": email})
        if doc is None:
            return None
        _parsed[upload_id] = _parse(doc)
    return _parsed[upload_id]


def get_active(email):
    upload_id = active_upload_id(email)
    return get_upload(email, upload_id) if upload_id else None


def list_uploads(email):
    docs = _uploads_col.find({"user_email": email}, {"csv_bytes": 0}).sort("uploaded_at", 1)
    return [
        {
            "id":         str(d["_id"]),
            "filename":   d["filename"],
            "rowCount":   d["row_count"],
            "uploadedAt": d["uploaded_at"].isoformat(),
        }
        for d in docs
    ]


def get_upload_info(email):
    up = get_active(email)
    if up is None:
        return {}
    return {
        "filename":  up["filename"],
        "row_count": up["row_count"],
        "col_map":   up["col_map"],
    }


def store_upload(email: str, df: pd.DataFrame, col_map: dict, filename: str):
    buf = io.BytesIO()
    df.to_csv(buf, index=False)
    upload_id = str(_uploads_col.insert_one({
        "user_email":  email,
        "csv_bytes":   buf.getvalue(),
        "col_map":     col_map,
        "filename":    filename,
        "row_count":   len(df),
        "uploaded_at": datetime.now(timezone.utc),
    }).inserted_id)
    users_collection.update_one({"email": email}, {"$set": {"active_upload_id": upload_id}})


def activate_upload(email, upload_id):
    if _uploads_col.find_one({"_id": ObjectId(upload_id), "user_email": email}, {"_id": 1}) is None:
        return False
    users_collection.update_one({"email": email}, {"$set": {"active_upload_id": upload_id}})
    return True


def clear_upload(email):
    users_collection.update_one({"email": email}, {"$unset": {"active_upload_id": ""}})


def standardize(df: pd.DataFrame, cm: dict) -> pd.DataFrame:
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


def load_data(email) -> pd.DataFrame:
    up = get_active(email)
    if up is not None:
        return standardize(up["df"].copy(), up["col_map"])

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

    if spending < RISK_HIGH_BELOW:
        return {"risk": "High Risk",   "level": 3, "color": "#EF4444", "badge": "🔴"}
    elif spending < RISK_MEDIUM_BELOW:
        return {"risk": "Medium Risk", "level": 2, "color": "#F59E0B", "badge": "🟡"}
    else:
        return {"risk": "Low Risk",    "level": 1, "color": "#10B981", "badge": "🟢"}
