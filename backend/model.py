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

from data_loader import (
    RISK_HIGH_BELOW,
    RISK_MEDIUM_BELOW,
    active_upload_id,
    assign_churn_risk,
    get_upload,
    list_uploads,
    load_data,
    preprocess,
    standardize,
)

FEATURE_COLS = [
    "Age", "AnnualIncome", "SpendingScore",
    "VisitFrequency", "SatisfactionScore",
    "ComplaintsCount", "LoyaltyPoints",
]
REQUIRED_COLS = FEATURE_COLS + ["ChurnRisk"]

RISK_RECOMMENDATIONS = {
    "High Risk":   "Offer retention discounts and personalized engagement campaigns.",
    "Medium Risk": "Monitor activity and provide targeted promotions.",
    "Low Risk":    "Maintain engagement and reward loyalty.",
}

K_RANGE = range(3, 8)
# Silhouette is O(n^2); above this many rows it is estimated on a fixed sample.
SILHOUETTE_SAMPLE = 3000

# Per-account state, rebuilt whenever that account's active upload changes.
_states: dict = {}


def _state(email):
    upload_id = active_upload_id(email)
    st = _states.get(email)
    if st is None or st["upload_id"] != upload_id:
        st = {
            "upload_id":     upload_id,
            "cache":         {},
            "fitted_km":     {},
            "models":        {},
            "comparison":    None,
            "label_encoder": None,
            "best_k":        None,
        }
        _states[email] = st
    return st


def compute_elbow(email, max_k: int = 10):
    df = load_data(email)
    _, scaled, _ = preprocess(df)

    wcss = []
    for k in range(1, max_k + 1):
        km = KMeans(n_clusters=k, init="k-means++", random_state=42, n_init=10)
        km.fit(scaled)
        wcss.append(round(km.inertia_, 2))

    return [{"k": i + 1, "wcss": w} for i, w in enumerate(wcss)]


def _silhouette(scaled, labels):
    size = SILHOUETTE_SAMPLE if len(scaled) > SILHOUETTE_SAMPLE else None
    return round(float(silhouette_score(scaled, labels, sample_size=size, random_state=42)), 4)


def best_k(email):
    """The k in K_RANGE with the highest silhouette score for the active dataset."""
    st = _state(email)
    if st["best_k"] is None:
        df = load_data(email)
        _, scaled, _ = preprocess(df)
        scores = {}
        for k in K_RANGE:
            labels = KMeans(n_clusters=k, init="k-means++", random_state=42, n_init=10).fit_predict(scaled)
            scores[k] = _silhouette(scaled, labels)
        st["best_k"] = {"bestK": max(scores, key=scores.get), "scores": scores}
    return st["best_k"]


def run_clustering(email, k: int = 5):
    st = _state(email)
    cache_key = f"cluster_{k}"
    if cache_key in st["cache"]:
        return st["cache"][cache_key]

    df = load_data(email)
    df_proc, scaled, scaler = preprocess(df)

    km = KMeans(n_clusters=k, init="k-means++", random_state=42, n_init=10)
    labels = km.fit_predict(scaled)
    df_proc["Cluster"] = labels

    st["fitted_km"][k] = (km, scaler)

    sil = _silhouette(scaled, labels) if k > 1 else 0.0

    cluster_stats = {}
    for c in range(k):
        subset = df_proc[df_proc["Cluster"] == c]
        cluster_stats[c] = {
            "avg_spending": round(subset["SpendingScore"].mean(), 1),
            "avg_income":   round(subset["AnnualIncome"].mean(), 1),
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

    st["cache"][cache_key] = result
    return result


def _classification_metrics(y_true, y_pred):
    return {
        "accuracy":  round(accuracy_score(y_true, y_pred) * 100, 2),
        "precision": round(precision_score(y_true, y_pred, average="weighted") * 100, 2),
        "recall":    round(recall_score(y_true, y_pred, average="weighted") * 100, 2),
        "f1":        round(f1_score(y_true, y_pred, average="weighted") * 100, 2),
    }


def train_churn_models(email):
    st = _state(email)
    if st["comparison"] is not None:
        return

    df = load_data(email)
    missing = [c for c in REQUIRED_COLS if c not in df.columns]
    if missing:
        st["comparison"] = {"available": False, "missing": missing}
        return

    df = df.dropna(subset=["ChurnRisk"])
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
        st["models"][name] = clf

    best = max(results, key=lambda n: (results[n]["f1"], results[n]["accuracy"]))
    st["label_encoder"] = le
    st["comparison"] = {"available": True, "models": results, "best": best}


def get_model_comparison(email):
    train_churn_models(email)
    return _state(email)["comparison"]


def get_trends(email):
    points = []
    for up in list_uploads(email):
        parsed = get_upload(email, up["id"])
        df = standardize(parsed["df"].copy(), parsed["col_map"])
        spend = df["SpendingScore"]
        n = len(df)
        points.append({
            "id":          up["id"],
            "filename":    up["filename"],
            "uploadedAt":  up["uploadedAt"],
            "rows":        n,
            "highPct":     round(float((spend < RISK_HIGH_BELOW).mean() * 100), 1),
            "mediumPct":   round(float(((spend >= RISK_HIGH_BELOW) & (spend < RISK_MEDIUM_BELOW)).mean() * 100), 1),
            "lowPct":      round(float((spend >= RISK_MEDIUM_BELOW).mean() * 100), 1),
            "avgSpending": round(float(spend.mean()), 1),
            "avgIncome":   round(float(df["AnnualIncome"].mean()), 1),
        })
    return points


def predict_customer(
    email,
    age: float,
    income: float,
    spending: float,
    gender: str,
    visit_frequency: float = 0,
    satisfaction_score: float = 5,
    complaints_count: float = 0,
    loyalty_points: float = 0,
    k: int = 5,
):
    # ── Step 1: cluster-based segment risk (always available) ────────────────
    result = run_clustering(email, k)
    km, scaler = _state(email)["fitted_km"][k]

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
    comparison = get_model_comparison(email)
    st = _state(email)
    model_used = None

    if comparison["available"]:
        model_used = comparison["best"]
        model = st["models"][model_used]
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
        churn_prediction = st["label_encoder"].inverse_transform([pred])[0]

        if churn_prediction == "High":
            churn_prediction = "High Risk"
        elif churn_prediction == "Medium":
            churn_prediction = "Medium Risk"
        elif churn_prediction == "Low":
            churn_prediction = "Low Risk"

        probs = model.predict_proba(features)[0]
        confidence = round(float(max(probs) * 100), 1)

    # ── Step 3: build response ───────────────────────────────────────────────
    badge_map = {
        "High Risk": "🔴",
        "Medium Risk": "🟡",
        "Low Risk": "🟢",
    }

    return {
        "cluster":            cluster,
        "k":                  k,
        "segmentRisk":        segment_risk["risk"],
        "predictedChurnRisk": churn_prediction,
        "confidence":         confidence,
        "modelUsed":          model_used,
        "recommendation":     RISK_RECOMMENDATIONS.get(churn_prediction, "Maintain engagement."),
        "riskColor":          segment_risk["color"],
        "riskBadge":          badge_map.get(churn_prediction, "🟢"),
    }
