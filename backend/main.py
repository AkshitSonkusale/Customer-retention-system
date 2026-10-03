import io, uuid
import pandas as pd
from fastapi import FastAPI, Query, UploadFile, File, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends
from pydantic import BaseModel

from data_loader import has_upload, get_upload_info, store_upload, clear_upload
from model import compute_elbow, run_clustering, predict_customer, get_model_comparison
from report import build_report_pdf
from database import db, users_collection
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from ai_recommend import get_ai_recommendation

app = FastAPI(title="Mall Churn Prediction API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_pending: dict = {}


@app.get("/")
def root():
    return {"message": "Mall Churn API v2", "status": "running"}


@app.get("/test-db")
def test_db():
    return {"connected": True, "database": db.name}


class SignupRequest(BaseModel):
    username: str
    email:    str
    password: str


class LoginRequest(BaseModel):
    email:    str
    password: str


@app.post("/auth/signup")
def signup(req: SignupRequest):
    # Validation
    if not req.username or not req.email or not req.password:
        raise HTTPException(status_code=400, detail="All fields are required.")
    if len(req.username.strip()) < 2:
        raise HTTPException(status_code=400, detail="Username must be at least 2 characters.")
    if "@" not in req.email:
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    existing_user = users_collection.find_one({"email": req.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered.")

    hashed_password = hash_password(req.password)
    user = {
        "username":      req.username.strip(),
        "email":         req.email.lower().strip(),
        "password_hash": hashed_password,
    }
    users_collection.insert_one(user)

    token = create_access_token({"email": req.email, "username": req.username})
    return {"message": "Signup successful", "access_token": token, "token": token, "token_type": "bearer"}


@app.post("/auth/login")
def login(req: LoginRequest):
    # Validation
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required.")
    if "@" not in req.email:
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    user = users_collection.find_one({"email": req.email.lower().strip()})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    valid = verify_password(req.password, user["password_hash"])
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token({"email": user["email"], "username": user["username"]})
    return {"message": "Login successful", "access_token": token, "token": token, "token_type": "bearer"}


@app.get("/auth/me")
def me(current_user=Depends(get_current_user)):
    return {"username": current_user["username"], "email": current_user["email"]}


@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only CSV files are supported.")
    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(400, f"Could not parse CSV: {e}")
    if len(df) < 5:
        raise HTTPException(400, "Dataset too small — need at least 5 rows.")

    numeric_cols     = df.select_dtypes(include="number").columns.tolist()
    categorical_cols = df.select_dtypes(exclude="number").columns.tolist()
    all_cols         = df.columns.tolist()

    def guess(candidates, keywords):
        for col in candidates:
            for kw in keywords:
                if kw in col.lower():
                    return col
        return None

    suggestion = {
        "id":       guess(all_cols,                    ["id", "customerid", "customer_id", "cust"]),
        "gender":   guess(categorical_cols + all_cols, ["gender", "sex"]),
        "age":      guess(numeric_cols,                ["age"]),
        "income":   guess(numeric_cols,                ["income", "salary", "earning", "annual"]),
        "spending": guess(numeric_cols,                ["spending", "score", "spend", "purchase"]),
    }

    token = str(uuid.uuid4())
    _pending[token] = {"df": df, "filename": file.filename}
    preview = df.head(5).fillna("").to_dict(orient="records")

    return {
        "token":              token,
        "filename":           file.filename,
        "totalRows":          len(df),
        "columns":            all_cols,
        "numericColumns":     numeric_cols,
        "categoricalColumns": categorical_cols,
        "suggestion":         suggestion,
        "preview":            preview,
    }


class ConfirmBody(BaseModel):
    token:   str
    col_map: dict


@app.post("/upload/confirm")
def confirm_upload(body: ConfirmBody):
    if body.token not in _pending:
        raise HTTPException(400, "Upload token expired or not found. Please re-upload.")

    df       = _pending[body.token]["df"].copy()
    filename = _pending[body.token]["filename"]

    required = ["age", "income", "spending"]
    for r in required:
        if not body.col_map.get(r):
            raise HTTPException(400, f"Missing required mapping: '{r}'")
        if body.col_map[r] not in df.columns:
            raise HTTPException(400, f"Column '{body.col_map[r]}' not in CSV.")

    for role in required:
        col = body.col_map[role]
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=[body.col_map[r] for r in required])

    store_upload(df, body.col_map, filename)
    del _pending[body.token]

    return {
        "status":     "ok",
        "filename":   filename,
        "rowsLoaded": len(df),
        "colMap":     body.col_map,
    }


@app.get("/dataset/info")
def dataset_info():
    if has_upload():
        info = get_upload_info()
        return {"source": "upload", **info}
    return {
        "source":    "default",
        "filename":  "synthetic_customer_dataset.csv",
        "row_count": 10000,
        "col_map": {
            "id":       "CustomerID",
            "gender":   "Gender",
            "age":      "Age",
            "income":   "AnnualIncome",
            "spending": "SpendingScore",
        },
    }


@app.delete("/dataset")
def reset_dataset():
    clear_upload()
    return {"status": "reset", "source": "default"}


@app.get("/elbow")
def elbow_data(max_k: int = Query(default=10, ge=2, le=15)):
    return {"data": compute_elbow(max_k)}


@app.get("/cluster")
def cluster_data(k: int = Query(default=5, ge=2, le=10)):
    return run_clustering(k)


@app.get("/customers")
def get_customers(k: int = Query(default=5, ge=2, le=10)):
    result = run_clustering(k)
    return {"total": result["totalCustomers"], "customers": result["customers"]}


@app.get("/summary")
def get_summary(k: int = Query(default=5, ge=2, le=10)):
    result = run_clustering(k)
    return {
        "k":               result["k"],
        "silhouetteScore": result["silhouetteScore"],
        "totalCustomers":  result["totalCustomers"],
        "clusters":        result["clusters"],
        "riskBreakdown": {
            "high":   sum(1 for c in result["customers"] if c["riskLevel"] == 3),
            "medium": sum(1 for c in result["customers"] if c["riskLevel"] == 2),
            "low":    sum(1 for c in result["customers"] if c["riskLevel"] == 1),
        },
    }


class PredictRequest(BaseModel):
    age:               float
    annualIncome:      float
    spendingScore:     float
    gender:            str   = "Unknown"
    visitFrequency:    float = 0
    satisfactionScore: float = 5
    complaintsCount:   float = 0
    loyaltyPoints:     float = 0


@app.post("/predict")
def predict(req: PredictRequest):
    return predict_customer(
        req.age,
        req.annualIncome,
        req.spendingScore,
        req.gender,
        req.visitFrequency,
        req.satisfactionScore,
        req.complaintsCount,
        req.loyaltyPoints,
    )


@app.get("/model-comparison")
def model_comparison():
    return get_model_comparison()


@app.get("/report")
def report(k: int = Query(default=5, ge=2, le=10)):
    pdf = build_report_pdf(k)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="churn_report_k{k}.pdf"'},
    )


class RecommendRequest(BaseModel):
    age:               float
    annualIncome:      float
    spendingScore:     float
    gender:            str   = "Unknown"
    visitFrequency:    float = 0
    satisfactionScore: float = 5
    complaintsCount:   float = 0
    loyaltyPoints:     float = 0
    predictedChurnRisk: str
    cluster:            int
    confidence:          float | None = None


@app.post("/recommend")
def recommend(req: RecommendRequest):
    profile = req.model_dump(exclude={"predictedChurnRisk", "cluster", "confidence"})
    try:
        text = get_ai_recommendation(profile, req.predictedChurnRisk, req.cluster, req.confidence)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"recommendation": text}
