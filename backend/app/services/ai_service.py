import os
import json
import re
from dotenv import load_dotenv
from pathlib import Path
from typing import List, Dict, Any

# Force-load .env from backend root
for _p in [
    Path(__file__).resolve().parent.parent.parent / '.env',
    Path(__file__).resolve().parent.parent.parent.parent / '.env',
]:
    if _p.exists():
        load_dotenv(_p)
        break
load_dotenv()  # also try CWD

from ..schemas import ai as ai_schemas

# ─── Model names ──────────────────────────────────────────────────────────────
GROQ_MODEL   = "llama-3.3-70b-versatile"
OPENAI_MODEL = "gpt-4o-mini"

# ─── Client factory ───────────────────────────────────────────────────────────
def _get_groq_client():
    """Use the native groq SDK — avoids the 403 that hits when routing
    Groq traffic through the OpenAI client on restricted cloud IPs."""
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        return None
    try:
        from groq import Groq
        return Groq(api_key=key)
    except Exception as e:
        print(f"⚠️  groq SDK unavailable: {e}")
        return None

def _get_openai_client():
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        return None
    try:
        from openai import OpenAI
        return OpenAI(api_key=key)
    except Exception as e:
        print(f"⚠️  openai SDK unavailable: {e}")
        return None

def _chat_completion(messages: list, max_tokens: int = 800,
                     json_mode: bool = False) -> str:
    """
    Try Groq first (native SDK), fall back to OpenAI.
    Returns the assistant message content as a string.
    """
    # ── 1. Try Groq native SDK ────────────────────────────────────────────────
    groq = _get_groq_client()
    if groq:
        try:
            kwargs: Dict[str, Any] = dict(
                model=GROQ_MODEL,
                messages=messages,
                temperature=0.7,
                max_tokens=max_tokens,
            )
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            resp = groq.chat.completions.create(**kwargs)
            return resp.choices[0].message.content or ""
        except Exception as e:
            print(f"⚠️  Groq call failed ({e}), trying OpenAI…")

    # ── 2. Fall back to OpenAI ────────────────────────────────────────────────
    openai = _get_openai_client()
    if openai:
        try:
            kwargs = dict(
                model=OPENAI_MODEL,
                messages=messages,
                temperature=0.7,
                max_tokens=max_tokens,
            )
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            resp = openai.chat.completions.create(**kwargs)
            return resp.choices[0].message.content or ""
        except Exception as e:
            print(f"❌ OpenAI call also failed: {e}")
            raise

    raise RuntimeError(
        "No AI provider available. Set GROQ_API_KEY or OPENAI_API_KEY in .env"
    )

# ─── Helpers ──────────────────────────────────────────────────────────────────
def _clean_json(text: str) -> str:
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```", "", text)
    return text.strip()

def _clean_pdf_text(text: str) -> str:
    text = text.replace("\x00", "")
    text = re.sub(r"[^\x20-\x7E\n]", "", text)
    return text.strip()

def _regex_personal_info(cv_text: str) -> dict:
    info: Dict[str, str] = {"full_name": "", "email": "", "phone": "", "job_title": ""}
    m = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", cv_text)
    if m:
        info["email"] = m.group(0)
    m = re.search(r"[\+\(]?[1-9][0-9 .\-\(\)]{8,}[0-9]", cv_text)
    if m:
        info["phone"] = m.group(0).strip()
    blacklist = ["Curriculum", "Vitae", "Resume", "Page", "Contact",
                 "Phone", "Email", "Address", "Education"]
    for line in [l.strip() for l in cv_text.split("\n") if l.strip()][:5]:
        if (len(line.split()) <= 4
                and not any(c.isdigit() for c in line)
                and "@" not in line
                and not any(b.upper() in line.upper() for b in blacklist)):
            info["full_name"] = line
            break
    return info

# ─── Chat endpoint ────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """\
You are the "AI Career Architect", embedded inside a Resume Builder App.

CRITICAL INSTRUCTIONS ON FILE UPLOADS:
If the user mentions "Upload", "Review my CV", "Read my Resume", "Old CV", or similar:
--> STOP. Tell them exactly:
"I can certainly do that! Please click the 📎 Paperclip Icon (bottom left) to upload your PDF/Docx, and I will analyze it instantly."

GENERAL FLOW (fresh start):
1. Greeting.
2. Ask Target Job Title.
3. Ask Key Skills.
4. Ask Experience Level.

FINAL OUTPUT TRIGGER:
When you have {Name, Job, Skills, Experience}, output exactly:
BUILDING_CV_NOW
{
   "full_name": "...",
   "desired_job_title": "...",
   "top_skills": ["..."],
   "experience_level": "...",
   "professional_summary": "..."
}
"""

def chat_with_user(history: List[Dict[str, Any]], latest_message: str) -> Dict[str, Any]:
    messages = ([{"role": "system", "content": SYSTEM_PROMPT}]
                + history
                + [{"role": "user", "content": latest_message}])
    try:
        reply = _chat_completion(messages, max_tokens=600)
        if "BUILDING_CV_NOW" in reply:
            parts = reply.split("BUILDING_CV_NOW")
            text_part = parts[0].strip()
            try:
                data = json.loads(_clean_json(parts[1]))
                return {"reply": text_part or "Building your resume…",
                        "action": "generate", "data": data}
            except Exception:
                pass
        return {"reply": reply, "action": "chat", "data": None}
    except Exception as e:
        print(f"Chat Error: {e}")
        return {
            "reply": (
                "⚠️ AI service temporarily unavailable. "
                "Please check your API key in the .env file and try again."
            ),
            "action": "chat",
            "data": None,
        }

# ─── CV generation ────────────────────────────────────────────────────────────
def generate_cv_content_from_ai(
    request: "ai_schemas.AIGenerationRequest",
) -> "ai_schemas.AIResponse":
    try:
        raw_text = ""
        is_upload = False
        regex_info: Dict[str, str] = {}

        if (request.personal_strengths
                and "SUMMARIZE THIS RESUME:" in request.personal_strengths):
            is_upload = True
            raw_text = _clean_pdf_text(
                request.personal_strengths.replace("SUMMARIZE THIS RESUME:", "")
            )[:4000]
            regex_info = _regex_personal_info(raw_text)
            print(f"📋 Regex extracted: {regex_info}")

        if is_upload:
            prompt = f"""Read this resume text:
---
{raw_text}
---
Extract structured JSON. Rules:
1. Use the candidate name found in the text.
2. Summarize experience as impactful bullets.

OUTPUT JSON:
{{
    "full_name": "{regex_info.get('full_name') or 'Candidate Name'}",
    "email": "{regex_info.get('email') or ''}",
    "phone": "{regex_info.get('phone') or ''}",
    "desired_job_title": "{request.desired_job_title or 'Professional'}",
    "professional_summary": "Summary...",
    "experience_points": ["Achievement 1", "Achievement 2"],
    "education_formatted": "Education info...",
    "suggested_skills": ["Skill A", "Skill B"]
}}"""
        else:
            skills = ", ".join(request.top_skills)
            prompt = f"""Create a CV for: {request.desired_job_title}
Skills: {skills}

OUTPUT JSON:
{{
    "full_name": "{request.full_name}",
    "email": "{request.email}",
    "phone": "",
    "desired_job_title": "{request.desired_job_title}",
    "professional_summary": "Professional summary...",
    "experience_points": ["Achieved X", "Led Y", "Built Z"],
    "education_formatted": "Education...",
    "suggested_skills": ["{skills}"]
}}"""

        raw = _chat_completion(
            [{"role": "user", "content": prompt}],
            max_tokens=900,
            json_mode=True,
        )
        data = json.loads(raw)

        # Identity guard — prevent AI hallucinating a wrong name
        if is_upload:
            bad = ["Mathematics", "Graduate", "Lecturer", "Resume",
                   "Curriculum", "Vitae"]
            name = data.get("full_name", "")
            if any(b in name for b in bad) or len(name) < 3:
                if regex_info.get("full_name"):
                    print(f"🛡️  Replacing bad name '{name}' → '{regex_info['full_name']}'")
                    data["full_name"] = regex_info["full_name"]
            if not data.get("phone") and regex_info.get("phone"):
                data["phone"] = regex_info["phone"]
            if "@" not in data.get("email", "") and regex_info.get("email"):
                data["email"] = regex_info["email"]

        return ai_schemas.AIResponse(
            success=True,
            data=ai_schemas.AIGeneratedContent(**data),
        )

    except Exception as e:
        print(f"Gen Error: {e}")
        return ai_schemas.AIResponse(success=False, error={"detail": str(e)})

# ─── Aliases (keep backward compatibility with any imports) ───────────────────
def generate_full_cv_package(req):
    res = generate_cv_content_from_ai(req)
    return res.data if res.success else None

def generate_cv_content(req):
    return generate_full_cv_package(req)

def load_model():
    pass
