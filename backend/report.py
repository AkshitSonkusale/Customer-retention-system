import io
import os
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from data_loader import CSV_PATH, get_upload_info
from model import get_model_comparison, run_clustering

MODEL_LABELS = {"randomForest": "Random Forest", "xgboost": "XGBoost"}
CUSTOMER_ROWS = 50

HEADER_BG = colors.HexColor("#1f2937")
GRID = colors.HexColor("#d1d5db")
STRIPE = colors.HexColor("#f3f4f6")


def _table(data, col_widths=None):
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, GRID),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, STRIPE]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def build_report_pdf(k: int) -> bytes:
    summary = run_clustering(k)
    comparison = get_model_comparison()
    styles = getSampleStyleSheet()
    story = []

    dataset_name = get_upload_info().get("filename") or os.path.basename(CSV_PATH)
    story.append(Paragraph("CustomerIQ Churn Report", styles["Title"]))
    story.append(Paragraph(
        f"Generated {datetime.now():%Y-%m-%d %H:%M} &nbsp;|&nbsp; Dataset: {dataset_name}"
        f" &nbsp;|&nbsp; Clusters (k): {k}",
        styles["Normal"],
    ))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("Overview", styles["Heading2"]))
    breakdown = {
        "High Risk":   sum(1 for c in summary["customers"] if c["riskLevel"] == 3),
        "Medium Risk": sum(1 for c in summary["customers"] if c["riskLevel"] == 2),
        "Low Risk":    sum(1 for c in summary["customers"] if c["riskLevel"] == 1),
    }
    total = summary["totalCustomers"]
    overview = [["Metric", "Value"], ["Total customers", f"{total:,}"], ["Silhouette score", summary["silhouetteScore"]]]
    for label, count in breakdown.items():
        overview.append([label, f"{count:,} ({count / total * 100:.1f}%)" if total else "0"])
    story.append(_table(overview, col_widths=[80 * mm, 80 * mm]))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("Model Comparison", styles["Heading2"]))
    if comparison["available"]:
        best = comparison["best"]
        story.append(Paragraph(
            f"Selected model: <b>{MODEL_LABELS[best]}</b> (highest weighted F1 on a 20% held-out test split).",
            styles["Normal"],
        ))
        story.append(Spacer(1, 3 * mm))
        rows = [["Model", "Accuracy", "Precision", "Recall", "F1", "Selected"]]
        for name, m in comparison["models"].items():
            rows.append([
                MODEL_LABELS[name],
                f"{m['accuracy']:.2f}%", f"{m['precision']:.2f}%",
                f"{m['recall']:.2f}%", f"{m['f1']:.2f}%",
                "Yes" if name == best else "",
            ])
        story.append(_table(rows))
    else:
        story.append(Paragraph(
            "Model comparison is unavailable for this dataset. Missing columns: "
            + ", ".join(comparison["missing"]) + ".",
            styles["Normal"],
        ))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("Cluster Summary", styles["Heading2"]))
    cluster_rows = [["Cluster", "Risk", "Customers", "Avg Spend", "Avg Income (k$)", "Avg Age"]]
    for c in summary["clusters"]:
        cluster_rows.append([
            c["id"], c["churnRisk"], f"{c['count']:,}",
            c["avgSpending"], c["avgIncome"], c["avgAge"],
        ])
    story.append(_table(cluster_rows))
    story.append(Spacer(1, 6 * mm))

    high_risk = [c for c in summary["customers"] if c["riskLevel"] == 3]
    story.append(Paragraph(
        f"High-Risk Customers (showing {min(CUSTOMER_ROWS, len(high_risk))} of {len(high_risk):,})",
        styles["Heading2"],
    ))
    customer_rows = [["ID", "Gender", "Age", "Income (k$)", "Spending", "Cluster"]]
    for c in high_risk[:CUSTOMER_ROWS]:
        customer_rows.append([c["id"], c["gender"], c["age"], c["annualIncome"], c["spendingScore"], c["cluster"]])
    if len(customer_rows) > 1:
        story.append(_table(customer_rows))
    else:
        story.append(Paragraph("No high-risk customers in this segmentation.", styles["Normal"]))

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=18 * mm, bottomMargin=18 * mm, title="CustomerIQ Churn Report")
    doc.build(story)
    return buffer.getvalue()
