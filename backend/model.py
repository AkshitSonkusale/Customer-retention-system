import numpy as np
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
)
from xgboost import XGBClassifier

from data_loader import load_data, preprocess, assign_churn_risk

FEATURE_COLS = [
    "Age", "AnnualIncome", "SpendingScore",
    "VisitFrequency", "SatisfactionScore",
    "ComplaintsCount", "LoyaltyPoints",
]
REQUIRED_COLS = FEATURE_COLS + ["ChurnRisk"]

_cache = {}
_models = {}
_label_encoder = None
_comparison = None

# FIX: store fitted KMeans objects so predict_customer reuses them
# instead of re-fitting from scratch on every prediction call.
_fitted_km: dict = {}   # key: k  ->  fitted KMeans instance


def compute_elbow(max_k: int = 10):
    df = load_data()
    _, scaled, _ = preprocess(df)

    wcss = []
    for k in range(1, max_k + 1):
        km = KMeans(n_clusters=k, init="k-means++", random_state=42, n_init=10)
        km.fit(scaled)
        wcss.append(round(km.inertia_, 2))

    return [{"k": i + 1, "wcss": w} for i, w in enumerate(wcss)]


def run_clustering(k: int = 5):
    cache_key = f"cluster_{k}"
    if cache_key in _cache:
        return _cache[cache_key]

    df = load_data()
    df_proc, scaled, scaler = preprocess(df)

    km = KMeans(n_clusters=k, init="k-means++", random_state=42, n_init=10)
    labels = km.fit_predict(scaled)
    df_proc["Cluster"] = labels

    # FIX: cache the fitted KMeans so predict_customer can reuse it
    _fitted_km[k] = (km, scaler)

    sil = round(silhouette_score(scaled, labels), 4) if k > 1 else 0.0

    cluster_stats = {}
    for c in range(k):
        subset = df_proc[df_proc["Cluster"] == c]
        cluster_stats[c] = {
            "avg_spending": round(subset["SpendingScore"].mean(), 1),
            "avg_income":   round(subset["AnnualIncome"].mean(), 1),
            # FIX: Age is now always guaranteed by load_data(), safe to read
            "avg_age":      round(subset["Age"].mean(), 1),
            "count":        len(subset),
        }

    customers = []
    for _, row in df_proc.iterrows():
        cid = int(row["Cluster"])
        risk = assign_churn_risk(cid, cluster_stats)
        customers.append({
            "id":           int(row["CustomerID"]),
            "gender":       row["Gender"],
            # FIX: Age always exists; cast safely
            "age":          int(row["Age"]),
            "annualIncome": int(row["AnnualIncome"]),
            "spendingScore":int(row["SpendingScore"]),
            "cluster":      cid,
            "churnRisk":    risk["risk"],
            "riskLevel":    risk["level"],
            "riskColor":    risk["color"],
            "riskBadge":    risk["badge"],
        })

    clusters = []
    for c in range(k):
        stats = cluster_stats[c]
        risk_info = assign_churn_risk(c, cluster_stats)
        clusters.append({
            "id":          c,
            "count":       stats["count"],
            "avgSpending": stats["avg_spending"],
            "avgIncome":   stats["avg_income"],
            "avgAge":      stats["avg_age"],
            "churnRisk":   risk_info["risk"],
            "riskLevel":   risk_info["level"],
            "riskColor":   risk_info["color"],
            "riskBadge":   risk_info["badge"],
        })

    clusters.sort(key=lambda x: -x["riskLevel"])

    result = {
        "k":               k,
        "silhouetteScore": sil,
        "totalCustomers":  len(customers),
        "clusters":        clusters,
        "customers":       customers,
        "scatterData": [
            {
                "x":       int(row["AnnualIncome"]),
                "y":       int(row["SpendingScore"]),
                "cluster": int(row["Cluster"]),
                "age":     int(row["Age"]),
                "id":      int(row["CustomerID"]),
            }
            for _, row in df_proc.iterrows()
        ],
    }

    _cache[cache_key] = result
    return result


def reset_cache():
    global _comparison, _label_encoder
    _cache.clear()
    _fitted_km.clear()
    _models.clear()
    _comparison = None
    _label_encoder = None


def _classification_metrics(y_true, y_pred):
    return {
        "accuracy":  round(accuracy_score(y_true, y_pred) * 100, 2),
        "precision": round(precision_score(y_true, y_pred, average="weighted") * 100, 2),
        "recall":    round(recall_score(y_true, y_pred, average="weighted") * 100, 2),
        "f1":        round(f1_score(y_true, y_pred, average="weighted") * 100, 2),
    }


def train_churn_models():
    """
    Train Random Forest and XGBoost on the same split when the dataset has the
    extended churn columns, and keep the one with the higher weighted F1.
    """
    global _comparison, _label_encoder

    if _comparison is not None:
        return

    df = load_data()
    missing = [c for c in REQUIRED_COLS if c not in df.columns]
    if missing:
        _comparison = {"available": False, "missing": missing}
        return

    le = LabelEncoder()
    y = le.fit_transform(df["ChurnRisk"])
    X = df[FEATURE_COLS]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    candidates = {
        "randomForest": RandomForestClassifier(n_estimators=100, random_state=42),
        "xgboost": XGBClassifier(
            n_estimators=200, max_depth=4, learning_rate=0.1,
            eval_metric="mlogloss", random_state=42,
        ),
    }

    results = {}
    for name, clf in candidates.items():
        clf.fit(X_train, y_train)
        results[name] = _classification_metrics(y_test, clf.predict(X_test))
        _models[name] = clf

    best = max(results, key=lambda n: (results[n]["f1"], results[n]["accuracy"]))
    _label_encoder = le
    _comparison = {"available": True, "models": results, "best": best}


def get_model_comparison():
    train_churn_models()
    return _comparison


def predict_customer(
    age: float,
    income: float,
    spending: float,
    gender: str,
    visit_frequency: float = 0,
    satisfaction_score: float = 5,
    complaints_count: float = 0,
    loyalty_points: float = 0,
):
    # ── Step 1: cluster-based segment risk (always available) ────────────────
    result = run_clustering(5)

    # FIX: reuse the KMeans already fitted in run_clustering instead of
    # fitting a brand-new one (which was wasteful and could diverge).
    if 5 in _fitted_km:
        km, scaler = _fitted_km[5]
    else:
        # Fallback: fit fresh if cache was cleared
        df = load_data()
        _, scaled_all, scaler = preprocess(df)
        km = KMeans(n_clusters=5, init="k-means++", random_state=42, n_init=10)
        km.fit(scaled_all)
        _fitted_km[5] = (km, scaler)

    raw = np.array([[income, spending]], dtype=float)
    scaled_input = scaler.transform(raw)
    cluster = int(km.predict(scaled_input)[0])

    cluster_stats = {
        c["id"]: {
            "avg_spending": c["avgSpending"],
            "avg_income":   c["avgIncome"],
        }
        for c in result["clusters"]
    }

    segment_risk = assign_churn_risk(cluster, cluster_stats)

    # Default: use the cluster-based risk label
    churn_prediction = segment_risk["risk"]
    confidence = None

    # ── Step 2: use the best supervised model if the dataset supports it ─────
    comparison = get_model_comparison()
    model_used = None

    if comparison["available"]:
        model_used = comparison["best"]
        model = _models[model_used]
        features = [[
            age,
            income,
            spending,
            visit_frequency,
            satisfaction_score,
            complaints_count,
            loyalty_points
        ]]

        pred = int(model.predict(features)[0])
        churn_prediction = _label_encoder.inverse_transform([pred])[0]

        if churn_prediction == "High":
            churn_prediction = "High Risk"
        elif churn_prediction == "Medium":
            churn_prediction = "Medium Risk"
        elif churn_prediction == "Low":
            churn_prediction = "Low Risk"

        probs = model.predict_proba(features)[0]
        confidence = round(float(max(probs) * 100), 1)

    # ── Step 3: build response ───────────────────────────────────────────────
    recommendations = {
        "High Risk":   "Offer retention discounts and personalized engagement campaigns.",
        "Medium Risk": "Monitor activity and provide targeted promotions.",
        "Low Risk":    "Maintain engagement and reward loyalty.",
    }

    badge_map = {
        "High Risk": "🔴",
        "Medium Risk": "🟡",
        "Low Risk": "🟢",
    }

    return {
        "cluster":            cluster,
        "segmentRisk":        segment_risk["risk"],
        "predictedChurnRisk": churn_prediction,
        "confidence":         confidence,
        "modelUsed":          model_used,
        "recommendation":     recommendations.get(churn_prediction, "Maintain engagement."),
        "riskColor":          segment_risk["color"],
        "riskBadge":          badge_map.get(churn_prediction, "🟢"),
    }
