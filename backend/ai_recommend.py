import os
from typing import Optional
import httpx
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "openai/gpt-oss-120b"

SYSTEM_PROMPT = (
    "You are a retention strategist for a shopping mall's loyalty programme. "
    "Given a customer's profile and churn risk, write ONE short, specific retention "
    "recommendation (2-3 sentences max). Reference the concrete numbers that justify it "
    "(age, spending trend, complaints, loyalty points) and avoid generic advice like "
    "'send a discount' unless the profile actually supports it. Plain text only, no markdown."
)


def get_ai_recommendation(profile: dict, risk: str, cluster: int, confidence: Optional[float]) -> str:
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not configured on the server.")

    user_prompt = (
        f"Customer profile:\n"
        f"- Gender: {profile.get('gender')}\n"
        f"- Age: {profile.get('age')}\n"
        f"- Annual income: {profile.get('annualIncome')}k\n"
        f"- Spending score: {profile.get('spendingScore')}/100\n"
        f"- Visit frequency: {profile.get('visitFrequency')} visits\n"
        f"- Satisfaction score: {profile.get('satisfactionScore')}/10\n"
        f"- Complaints filed: {profile.get('complaintsCount')}\n"
        f"- Loyalty points: {profile.get('loyaltyPoints')}\n\n"
        f"Predicted churn risk: {risk} (cluster {cluster}"
        + (f", {confidence}% confidence" if confidence is not None else "")
        + ")\n\n"
        "What retention action should we take, and why?"
    )

    try:
        resp = httpx.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.4,
                "max_tokens": 1000,
            },
            timeout=15,
        )
        resp.raise_for_status()
    except httpx.HTTPError as e:
        raise RuntimeError(f"Groq request failed: {e}") from e

    data = resp.json()
    return data["choices"][0]["message"]["content"].strip()
