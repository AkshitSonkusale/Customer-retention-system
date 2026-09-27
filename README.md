# CustomerIQ - Customer Retention System

A full-stack Machine Learning web application that identifies at-risk customers using K-Means Clustering and Random Forest / XGBoost Classification, segments them into behavioural groups, and generates AI-powered personalised retention strategies via Groq LLM — all through an interactive analytics dashboard.

> Built with FastAPI, React, MongoDB Atlas, and Groq (Llama 3.3 70B). Deployed on Render.

---

## Features

### Customer Segmentation
- K-Means Clustering (k-means++ initialisation)
- Elbow Method for optimal k selection
- Silhouette Score cluster quality evaluation
- Cluster-wise customer analysis
- Risk categorisation — High 🔴 / Medium 🟡 / Low 🟢
- Interactive scatter plot and elbow curve visualisations

### Churn Risk Classification
- **Random Forest Classifier** — interpretable feature importances, robust on tabular data
- **XGBoost Classifier** — gradient boosting with regularisation, benchmarked against Random Forest
- Confidence score per prediction
- Risk-level classification with per-cluster stats

### AI Retention Recommendations
- On-demand LLM-generated retention strategy per customer (Groq — Llama 3.3 70B)
- Reasons over the full behavioural profile (age, income, spending score, visit frequency, satisfaction score, complaints, loyalty points) instead of returning a generic templated offer
- Separate opt-in `/recommend` endpoint so the core prediction stays fast
- Falls back gracefully to a static recommendation if the Groq call is unavailable

### Dataset Upload
- Upload any custom CSV dataset
- Automatic column mapping with smart suggestions
- 5-row dataset preview before confirming
- Dynamic clustering and classification on uploaded data
- Reset to default dataset with one click

### Dashboard Analytics
- KPI cards — High / Medium / Low risk counts + Silhouette Score
- Random Forest / XGBoost model metrics (Accuracy, Precision, Recall, F1)
- Feature importance breakdown
- Income vs Spending Score scatter plot (colored by cluster)
- Elbow curve visualisation (WCSS vs k)
- Full customer table with filter, sort, and search
- Risk breakdown summaries per cluster

### Authentication
- User registration and login
- JWT token-based authentication
- bcrypt password hashing
- MongoDB Atlas user storage

---

## Tech Stack

### Frontend
- React 18, Vite
- Custom CSS — dark/light theme, comic-book inspired design
- Recharts (scatter plot, line chart)
- Axios
- Lucide React (icons)

### Backend
- FastAPI, Uvicorn
- Python 3.11
- Pandas, NumPy
- Scikit-learn (KMeans, StandardScaler, RandomForestClassifier)
- XGBoost
- python-jose (JWT), passlib + bcrypt (auth)
- PyMongo

### Machine Learning
- K-Means Clustering (unsupervised — Stage 1)
- Random Forest Classification (supervised — Stage 2, option A)
- XGBoost Classification (supervised — Stage 2, option B)
- StandardScaler for feature normalisation
- Silhouette Score for cluster quality
- 80/20 train-test split with stratification

### Generative AI
- Groq API — Llama 3.3 70B for personalised retention recommendation generation

### Database
- MongoDB Atlas — user authentication collection

### Deployment
- Frontend: Render (Static Site)
- Backend: Render (Web Service)
- Version Control: GitHub

---

## Project Structure

```
CustomerIQ/
│
├── backend/
│   ├── main.py              # FastAPI app, all routes
│   ├── model.py             # K-Means + RF / XGBoost pipeline
│   ├── ai_recommend.py      # Groq LLM retention recommendation
│   ├── data_loader.py       # CSV loading, upload store, preprocessing
│   ├── auth.py              # JWT creation/verification, bcrypt hashing
│   ├── database.py          # MongoDB Atlas connection
│   ├── Mall_Customers.csv   # Default dataset (200 rows)
│   ├── requirements.txt
│   └── runtime.txt
│
└── frontend/
    ├── src/
    │   ├── app.jsx                  # Root component, auth + routing
    │   ├── main.jsx
    │   ├── api.js                   # All Axios API calls
    │   ├── index.css                # CSS variables, dark/light themes
    │   ├── components/
    │   │   └── PixelLogo.jsx        # Animated pixel-grid Ci logo
    │   └── pages/
    │       ├── Login.jsx
    │       ├── Signup.jsx
    │       ├── AuthBackground.jsx   # Particle canvas animation
    │       ├── Dashboard.jsx
    │       ├── Customers.jsx
    │       ├── Predict.jsx
    │       └── Upload.jsx
    ├── package.json
    └── vite.config.js
```

---

## ML Pipeline

### Stage 1 — K-Means Clustering (Unsupervised)

Features used: `AnnualIncome`, `SpendingScore` only

Age and Gender deliberately excluded — including them drops the Silhouette Score from ~0.485 to ~0.32, confirmed by XGBoost and Random Forest feature importances showing Age at <1% contribution.

```python
KMeans(n_clusters=5, init='k-means++', n_init=10, random_state=42)
```

Optimal k selected via Elbow Method (WCSS vs k=1–10).

### Stage 2 — Classification (Supervised)

Features used:
```
Age, AnnualIncome, SpendingScore, VisitFrequency,
SatisfactionScore, ComplaintsCount, LoyaltyPoints
```

Target: `ChurnRisk` — High / Medium / Low

Two models evaluated:

```python
# Option A
RandomForestClassifier(n_estimators=100, random_state=42)

# Option B
XGBClassifier(n_estimators=100, random_state=42, eval_metric='mlogloss')
```

Random Forest provides interpretable feature importances. XGBoost offers gradient boosting with regularisation for improved generalisation. Both are evaluated on the same 80/20 stratified train-test split.

### Stage 3 — AI Recommendation (Generative AI)

Customer profile + predicted risk tier sent to Groq (Llama 3.3 70B) → 2–3 sentence personalised retention strategy referencing the customer's specific numbers.

### Risk Tiers

| Tier | Avg Cluster Spending | Action |
|---|---|---|
| 🔴 High Risk | < 35 | Immediate — discount, loyalty invite |
| 🟡 Medium Risk | 35–55 | Monitor — seasonal offer, membership upgrade |
| 🟢 Low Risk | > 55 | Maintain — VIP events, exclusive access |

---

## API Reference

Base URL: `https://customeriq-backend.onrender.com`

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | ✗ | Register new user |
| POST | `/auth/login` | ✗ | Login, returns JWT token |
| GET | `/auth/me` | ✓ | Current user info |

### Dataset Management

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/upload` | ✓ | Step 1: Upload CSV, get column suggestions + token |
| POST | `/upload/confirm` | ✓ | Step 2: Confirm column mapping |
| GET | `/dataset/info` | ✓ | Active dataset source and row count |
| DELETE | `/dataset` | ✓ | Reset to default dataset |

### Clustering & Analysis

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/cluster?k=5` | ✓ | Run K-Means, return scatter data + labels |
| GET | `/summary?k=5` | ✓ | Cluster stats + risk breakdown |
| GET | `/customers?k=5` | ✓ | All customers with risk labels |
| GET | `/elbow?max_k=10` | ✓ | WCSS values for elbow chart |
| GET | `/metrics` | ✓ | RF / XGBoost accuracy, precision, recall, F1, feature importances |

### Prediction & AI

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/predict` | ✓ | Predict churn risk for one customer |
| POST | `/recommend` | ✓ | Groq LLM personalised retention recommendation |

**POST `/predict` body:**
```json
{
  "age": 28,
  "annualIncome": 65,
  "spendingScore": 72,
  "gender": "Female",
  "visitFrequency": 10,
  "satisfactionScore": 8,
  "complaintsCount": 0,
  "loyaltyPoints": 4500
}
```

Swagger docs: `https://customeriq-backend.onrender.com/docs`

---

## Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB Atlas account (free tier)
- Groq API key — free at [console.groq.com](https://console.groq.com)

### 1. Clone the repository
```bash
git clone https://github.com/AkshitSonkusale/Mall-Customer-Churn-Prediction-System.git
cd Mall-Customer-Churn-Prediction-System
```

### 2. Backend setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
```

Create `backend/.env`:
```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
DB_NAME=mallchurn
JWT_SECRET=your-secret-key-here
JWT_EXPIRE_MINUTES=1440
GROQ_API_KEY=your-groq-api-key-here
```

```bash
uvicorn main:app --reload --port 8000
# API  → http://localhost:8000
# Docs → http://localhost:8000/docs
```

### 3. Frontend setup
```bash
cd frontend
npm install
npm run dev
# App → http://localhost:5173
```

---

## Dataset Format

### Minimum required columns

| Column | Type | Description |
|---|---|---|
| Age | Integer | Customer age |
| AnnualIncome | Integer | Yearly income in thousands |
| SpendingScore | Integer | Mall-assigned score 1–100 |

### Optional columns (enable full RF / XGBoost pipeline)

| Column | Type | Description |
|---|---|---|
| CustomerID | Integer | Unique identifier |
| Gender | String | Male / Female |
| VisitFrequency | Integer | Monthly mall visits |
| SatisfactionScore | Float | Rating 1–10 |
| ComplaintsCount | Integer | Number of complaints |
| LoyaltyPoints | Integer | Accumulated points |
| ChurnRisk | String | High / Medium / Low (target label) |

---

## Future Improvements

- XGBoost final model selection based on cross-validated F1 score
- SHAP values for per-prediction explainability
- Time-series trend features — spending score trajectory over months
- Feedback loop — track whether flagged customers were retained, retrain on outcomes
- PDF report generation and download
- Automated email/SMS delivery of AI recommendations via SendGrid
- Real-time customer risk monitoring with alerts
- Multi-user workspace with role-based access (Admin / Analyst)
- AutoML integration for automatic model selection

---

## Learning Outcomes

This project demonstrates:

- Unsupervised Learning — K-Means Clustering, Elbow Method, Silhouette Score
- Supervised Learning — Random Forest and XGBoost classification, model benchmarking
- Feature Engineering and selection (validated via feature importances)
- Generative AI API Integration — Groq (Llama 3.3 70B)
- FastAPI backend with JWT authentication
- React frontend with custom dark/light theming
- MongoDB Atlas integration
- Full-stack deployment on Render
- Two-stage ML pipeline design

---

## Author

**Akshit Sonkusale**
B.Tech Computer Science (Data Science) — Anurag University, Hyderabad

[GitHub](https://github.com/AkshitSonkusale)

---

## License

Developed for educational and academic purposes.
