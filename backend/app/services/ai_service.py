import os
from dotenv import load_dotenv
from pathlib import Path

# FORCE LOAD .env (Check Root and Backend folders)
env_path = Path(__file__).resolve().parent.parent.parent / '.env'
load_dotenv(env_path)
load_dotenv()  # Backup check in current dir

import json
import re
from typing import List, Dict, Any
from openai import OpenAI
from ..schemas import ai as ai_schemas

# No longer using local models - removed transformers imports
MODEL_ID = "microsoft/Phi-3-mini-4k-instruct"  # Kept for reference only
model = None
tokenizer = None

def get_client():
    # Priority: Groq > OpenAI > None
    api_key = os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")
    base_url = "https://api.groq.com/openai/v1" if os.getenv("GROQ_API_KEY") else None
    
    if not api_key:
        print("⚠️ Warning: No API Key found in .env. Falling back might fail.")
        return None
        
    return OpenAI(api_key=api_key, base_url=base_url)

def clean_json_response(text):
    # Remove markdown ```json ... ```
    clean = re.sub(r'```json\s*', '', text)
    clean = re.sub(r'```', '', clean)
    return clean.strip()

# --- PDF TEXT CLEANING ---
def clean_pdf_text(text: str) -> str:
    text = text.replace('\x00', '')
    text = re.sub(r'[^\x20-\x7E\n]', '', text) 
    return text.strip()

def extract_personal_info_regex(cv_text: str) -> dict:
    """Reliable Regex extraction to catch data the AI misses."""
    info = {"full_name": "", "email": "", "phone": "", "job_title": ""}
    
    # 1. Email
    email_match = re.search(r'[\w.+-]+@[\w-]+\.[\w.-]+', cv_text)
    if email_match: 
        info["email"] = email_match.group(0)
    
    # 2. Phone
    phone_match = re.search(r'[\+\(]?[1-9][0-9 .\-\(\)]{8,}[0-9]', cv_text)
    if phone_match: 
        info["phone"] = phone_match.group(0).strip()
    
    # 3. Name Heuristics (Look at first 5 lines, avoid 'Curriculum Vitae' etc)
    lines = [l for l in cv_text.split('\n') if l.strip()]
    blacklist = ["Curriculum", "Vitae", "Resume", "Page", "Contact", "Phone", "Email", "Address", "Education"]
    
    for line in lines[:5]:
        clean_line = line.strip()
        # Conditions: Short, no digits, no @, not blacklisted
        if len(clean_line.split()) <= 4 and not any(c.isdigit() for c in clean_line) and "@" not in clean_line:
            if not any(b.upper() in clean_line.upper() for b in blacklist):
                info["full_name"] = clean_line
                break
                
    return info

# --- THE SMART CHAT FUNCTION ---
def chat_with_user(history: List[Dict[str, Any]], latest_message: str) -> Dict[str, Any]:
    client = get_client()
    if not client:
        return {"reply": "API Key Missing. Check Server Logs.", "action": "chat", "data": None}

    model_name = "llama-3.3-70b-versatile" if os.getenv("GROQ_API_KEY") else "gpt-4o-mini"

    system_prompt = """
    You are the "AI Career Architect", embedded inside a Resume Builder App.
    
    CRITICAL INSTRUCTIONS ON FILE UPLOADS:
    You CANNOT accept pasted text for CV parsing nicely.
    If the user mentions "Upload", "Review my CV", "Read my Resume", "Old CV", or similar:
    --> STOP. Tell them exactly:
    "I can certainly do that! Please click the 📎 Paperclip Icon (bottom left) to upload your PDF/Docx, and I will analyze it instantly."
    
    (Do NOT ask them to paste text. Redirect them to the paperclip).

    GENERAL FLOW (If starting fresh):
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

    messages = [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": latest_message}]

    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0.7,
            max_tokens=600
        )
        reply = response.choices[0].message.content
        
        if "BUILDING_CV_NOW" in reply:
            parts = reply.split("BUILDING_CV_NOW")
            text_part = parts[0].strip()
            try:
                json_part = clean_json_response(parts[1])
                data = json.loads(json_part)
                return {"reply": text_part or "Generative Process Started...", "action": "generate", "data": data}
            except:
                pass
        
        return {"reply": reply, "action": "chat", "data": None}

    except Exception as e:
        print(f"Chat Error: {e}")
        return {"reply": "Connection hiccup.", "action": "chat", "data": None}


# --- CV GENERATION ---
def generate_cv_content_from_ai(request: ai_schemas.AIGenerationRequest) -> ai_schemas.AIResponse:
    print(f"Processing CV Generation Request...")
    try:
        client = get_client()
        if not client: 
            raise ValueError("No API Key")

        model_name = "llama-3.3-70b-versatile" if os.getenv("GROQ_API_KEY") else "gpt-4o-mini"
        
        # Check upload context
        raw_text = ""
        is_upload_mode = False
        extracted_regex = {}
        
        if request.personal_strengths and "SUMMARIZE THIS RESUME:" in request.personal_strengths:
            is_upload_mode = True
            full_text = request.personal_strengths.replace("SUMMARIZE THIS RESUME:", "")
            raw_text = clean_pdf_text(full_text)[:4000]  # Increased limit for Cloud
            
            # RUN REGEX NOW
            extracted_regex = extract_personal_info_regex(raw_text)
            print(f"📋 Regex Identified: {extracted_regex}")
        
        # PROMPTING
        if is_upload_mode:
            prompt = f"""
            Read this resume text:
            ---
            {raw_text}
            ---
            
            Goal: Extract structured JSON. 
            Rules:
            1. Extract the Candidate Name found in the text.
            2. Summarize experience into impactful bullets.
            
            OUTPUT JSON:
            {{
                "full_name": "{extracted_regex.get('full_name') or 'Candidate Name'}",
                "email": "{extracted_regex.get('email') or ''}",
                "phone": "{extracted_regex.get('phone') or ''}", 
                "desired_job_title": "{request.desired_job_title or 'Professional'}",
                "professional_summary": "Summary...",
                "experience_points": ["Achievement 1", "Achievement 2"],
                "education_formatted": "Education info...",
                "suggested_skills": ["Skill A", "Skill B"]
            }}
            """
        else:
            skills = ", ".join(request.top_skills)
            prompt = f"""
            Create a CV for: {request.desired_job_title}
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
            }}
            """
        
        # CALL API
        response = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        data = json.loads(response.choices[0].message.content)
        
        # === THE IDENTITY GUARD (Anti-Hallucination) ===
        if is_upload_mode:
            # Check for bad AI names
            bad_names = ["Mathematics", "Graduate", "Lecturer", "Resume", "Curriculum", "Vitae"]
            current_name = data.get("full_name", "")
            
            if any(bad in current_name for bad in bad_names) or len(current_name) < 3:
                # Fallback to Regex extraction
                if extracted_regex.get("full_name"):
                    print(f"🛡️ Replacing Bad Name '{current_name}' with '{extracted_regex['full_name']}'")
                    data["full_name"] = extracted_regex["full_name"]
            
            # Check Phone
            if not data.get("phone") and extracted_regex.get("phone"):
                data["phone"] = extracted_regex["phone"]
                
            # Check Email
            if "@" not in data.get("email", "") and extracted_regex.get("email"):
                data["email"] = extracted_regex["email"]

        return ai_schemas.AIResponse(success=True, data=ai_schemas.AIGeneratedContent(**data))

    except Exception as e:
        print(f"Gen Error: {e}")
        return ai_schemas.AIResponse(success=False, error={"detail": str(e)})

def generate_full_cv_package(req):
    res = generate_cv_content_from_ai(req)
    if not res.success: 
        return None
    return res.data

def generate_cv_content(req): 
    return generate_full_cv_package(req)

def load_model(): 
    pass