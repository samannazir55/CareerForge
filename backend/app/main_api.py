from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Response
from typing import List, Dict, Any, Union, cast
from sqlalchemy.orm import Session
import jinja2
import logging
import re

# Check for WeasyPrint
try:
    from weasyprint import HTML, CSS # type: ignore
    WEASYPRINT_AVAILABLE = True
except ImportError:
    WEASYPRINT_AVAILABLE = False

# Local Imports
from .database import get_db
from .schemas import user as user_schemas, cv as cv_schemas, ai as ai_schemas, template as template_schemas
from .crud import user as user_crud, cv as cv_crud, template as template_crud
from .core import security, config
from .services import ai_service, parser_service, file_service
from .models.package import Package
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter()
bearer = HTTPBearer()
logger = logging.getLogger("cv_api")

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    return security.verify_jwt_token(creds.credentials)

# ---------------------------------------------------------
# DATA NORMALIZER (Fixes Validation Errors)
# ---------------------------------------------------------
def normalize_cv_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Converts incoming React JSON (camelCase) to Schema-Compliant (snake_case)
    dictionary that matches the 'CVData' Pydantic model structure.
    NOW WITH CUSTOM FIELDS SUPPORT!
    """
    normalized: Dict[str, Any] = {}

    # 1. Key Mapping (React -> Schema)
    key_map = {
        # Basic Fields
        "fullName": "full_name",
        "jobTitle": "job_title",
        "phone": "phone",
        "email": "email",
        "summary": "summary",
        "experience": "experience",
        "education": "education",
        "skills": "skills",
        
        # NEW: Custom Sidebar Fields
        "location": "location",
        "hobbies": "hobbies",
        "languages": "languages",
        "certifications": "certifications",
        
        # NEW: Social Links
        "linkedin": "linkedin",
        "github": "github",
        "portfolio": "portfolio"
    }

    # Transfer existing keys
    for k, v in data.items():
        if k in key_map:
            normalized[key_map[k]] = v
        elif k in key_map.values():
            normalized[k] = v
        elif k in ["accentColor", "textColor", "fontFamily"]:
            normalized[k] = v

    # 2. Strict Defaults for Required Fields
    required_str_fields = ["full_name", "email", "phone", "job_title", "summary", "experience", "education"]
    for field in required_str_fields:
        if field not in normalized or normalized[field] is None:
            normalized[field] = ""
    
    # 3. Handle Skills List
    skills_raw = normalized.get("skills")
    if isinstance(skills_raw, str):
        if skills_raw.strip():
            normalized["skills"] = [s.strip() for s in skills_raw.split(',') if s.strip()]
        else:
            normalized["skills"] = []
    elif not isinstance(skills_raw, list):
        normalized["skills"] = []

    # 4. NEW: Handle Custom Lists (Hobbies, Languages, Certifications)
    for list_field in ["hobbies", "languages", "certifications"]:
        field_raw = normalized.get(list_field)
        if isinstance(field_raw, str):
            if field_raw.strip():
                normalized[list_field] = [s.strip() for s in field_raw.split(',') if s.strip()]
            else:
                normalized[list_field] = []
        elif not isinstance(field_raw, list):
            normalized[list_field] = []

    # 5. NEW: Handle Optional String Fields
    for str_field in ["location", "linkedin", "github", "portfolio"]:
        if str_field not in normalized or normalized[str_field] is None:
            normalized[str_field] = ""

    # 6. Generate Initials
    name = normalized.get("full_name", "")
    normalized["full_name_initials"] = name[:2].upper() if name else "??"

    # 7. Fix Accent Colors
    if "accentColor" in normalized: normalized["accent_color"] = normalized["accentColor"]
    if "textColor" in normalized: normalized["text_color"] = normalized["textColor"]
    if "fontFamily" in normalized: normalized["font_family"] = normalized["fontFamily"]
    
    normalized.setdefault("accent_color", "#2c3e50")
    normalized.setdefault("text_color", "#333333")
    
    return normalized
def camelize_cv_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Converts database JSON (snake_case) back to React-Compliant (camelCase)
    so the frontend can read the saved values correctly.
    """
    if not data:
        return {}
        
    camelized: Dict[str, Any] = {}
    
    # Reverse Key Mapping (Snake -> Camel)
    reverse_key_map = {
        "full_name": "fullName",
        "job_title": "jobTitle",
        "phone": "phone",
        "email": "email",
        "summary": "summary",
        "experience": "experience",
        "education": "education",
        "skills": "skills",
        "location": "location",
        "hobbies": "hobbies",
        "languages": "languages",
        "certifications": "certifications",
        "linkedin": "linkedin",
        "github": "github",
        "portfolio": "portfolio",
        "accent_color": "accentColor",
        "text_color": "textColor",
        "font_family": "fontFamily",
        "profile_image": "profileImage",
        "custom_fields": "customFields" # Supports our new custom sections!
    }
    
    for k, v in data.items():
        if k in reverse_key_map:
            camelized[reverse_key_map[k]] = v
        else:
            camelized[k] = v
            
    return camelized

def camelize_cv_record(db_cv: Any) -> Dict[str, Any]:
    """
    Converts a database SQLAlchemy CV record to a dictionary
    and camelizes its nested JSON data for React.
    """
    if not db_cv:
        return {}
        
    cv_dict = {
        "id": db_cv.id,
        "user_id": db_cv.user_id,
        "title": db_cv.title,
        "template_id": db_cv.template_id,
        "created_at": db_cv.created_at,
        "updated_at": db_cv.updated_at,
        "data": {}
    }
    
    raw_data = db_cv.data
    if hasattr(raw_data, "model_dump"):
        raw_dict = raw_data.model_dump()
    elif hasattr(raw_data, "dict"):
        raw_dict = raw_data.dict()
    elif isinstance(raw_data, dict):
        raw_dict = raw_data
    else:
        raw_dict = dict(raw_data) if raw_data else {}
        
    cv_dict["data"] = camelize_cv_dict(raw_dict)
    return cv_dict
def render_template_internal(html_content: str, css_content: str, data: Dict[str, Any]) -> str:
    """
    Safe Internal Rendering of HTML using Jinja2.
    Templates have #{{accent_color}} syntax, so we provide colors WITHOUT #.
    Also dynamically appends custom fields to keep database schemas clean.
    """
    mapped_data = normalize_cv_dict(data)
    
    # Add Boolean Helpers for Templates
    mapped_data["has_languages"] = len(mapped_data.get("languages", [])) > 0 if isinstance(mapped_data.get("languages"), list) else bool(mapped_data.get("languages"))
    mapped_data["has_certifications"] = len(mapped_data.get("certifications", [])) > 0 if isinstance(mapped_data.get("certifications"), list) else bool(mapped_data.get("certifications"))
    mapped_data["has_hobbies"] = len(mapped_data.get("hobbies", [])) > 0 if isinstance(mapped_data.get("hobbies"), list) else bool(mapped_data.get("hobbies"))
    
    def strip_hash(color):
        if not color:
            return "333333"
        clean = str(color).replace("#", "")
        if re.fullmatch(r"[0-9a-fA-F]{3}|[0-9a-fA-F]{6}", clean):
            if len(clean) == 3:
                clean = ''.join([c*2 for c in clean])
            return clean
        return "333333"
    
    if "accent_color" in mapped_data:
        mapped_data["accent_color"] = strip_hash(mapped_data["accent_color"])
    if "text_color" in mapped_data:
        mapped_data["text_color"] = strip_hash(mapped_data["text_color"])
    
    env = jinja2.Environment(loader=jinja2.BaseLoader())
    
    clean_html = html_content.replace("{{{", "{{").replace("}}}", " | safe }}")
    clean_css = css_content.replace("{{{", "{{").replace("}}}", " | safe }}")
    
    try:
        t_html = env.from_string(clean_html)
        t_css = env.from_string(clean_css or "")
        
        rendered_body = t_html.render(**mapped_data)
        rendered_css = t_css.render(**mapped_data)
        
        # --- DYNAMIC CUSTOM FIELDS INJECTION (Backend PDF) ---
        custom_fields = data.get("customFields") or data.get("custom_fields") or []
        if custom_fields and isinstance(custom_fields, list):
            custom_html = ""
            accent_color = mapped_data.get("accent_color") or "2c3e50"
            for field in custom_fields:
                if not isinstance(field, dict):
                    continue
                label = field.get("label", "")
                value = field.get("value", "")
                if not label or not value:
                    continue
                
                formatted_value = value.replace("\n", "<br/>")
                
                # Render custom fields based on template styles
                if "classic" in html_content.lower() or "classic" in rendered_body.lower():
                    custom_html += f"""
                    <h3 style="background:#f0f0f0; padding:5px 10px; text-transform:uppercase; font-size:14px; font-weight:bold; border-left:5px solid #333; margin-top:20px;">{label}</h3>
                    <div class="content" style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">{formatted_value}</div>
                    """
                else:
                    custom_html += f"""
                    <div class="section" style="margin-top:20px;">
                      <h2 style="color: #{accent_color}; border-bottom: 2px solid #{accent_color}; padding-bottom: 5px; text-transform: uppercase; margin-top: 0;">{label}</h2>
                      <div class="text" style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">{formatted_value}</div>
                    </div>
                    """
            
            # Inject custom HTML into template structure
            if "classic" in html_content.lower() and "</div>" in rendered_body:
                last_div_idx = rendered_body.rfind("</div>")
                rendered_body = rendered_body[:last_div_idx] + custom_html + rendered_body[last_div_idx:]
            elif "main-content" in rendered_body:
                main_content_keyword = "main-content"
                start_idx = rendered_body.find(main_content_keyword)
                remaining_html = rendered_body[start_idx:]
                closing_div_idx = remaining_html.find("</div>")
                if closing_div_idx != -1:
                    absolute_closing_idx = start_idx + closing_div_idx
                    rendered_body = rendered_body[:absolute_closing_idx] + custom_html + rendered_body[absolute_closing_idx:]
                else:
                    rendered_body += custom_html
            else:
                rendered_body += custom_html

        # CSS Cleanup
        rendered_css = re.sub(r'##+', '#', rendered_css)
        rendered_css = re.sub(r':\s*#\s*;', ': #333333;', rendered_css)
        rendered_css = re.sub(r':\s*#\s*\}', ': #333333', rendered_css)
        
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                {rendered_css}
                body {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }}
            </style>
        </head>
        <body>
            {rendered_body}
        </body>
        </html>
        """
    except Exception as e:
        logger.error(f"Render Error: {e}")
        return f"<h1>Error generating preview</h1><pre>{e}</pre>"

# ---------------------------------------------------------
# AUTH ENDPOINTS
# ---------------------------------------------------------
@router.post("/auth/register", response_model=user_schemas.Token)
def register(user: user_schemas.UserCreate, db: Session = Depends(get_db)):
    if user_crud.get_user_by_email(db, user.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = user_crud.create_user(db, user)
    token = security.create_jwt_token({"user_id": new_user.id, "email": new_user.email})
    return {"access_token": token, "token_type": "bearer"}

@router.post("/auth/login", response_model=user_schemas.Token)
def login(user: user_schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = user_crud.get_user_by_email(db, user.email)
    if not db_user or not security.verify_password(user.password, str(db_user.password_hash)): 
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = security.create_jwt_token({"user_id": db_user.id, "email": db_user.email})
    return {"access_token": token, "token_type": "bearer"}

@router.get("/auth/profile", response_model=user_schemas.User)
def profile(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return user_crud.get_user(db, int(user["user_id"]))

# ---------------------------------------------------------
# AI ENDPOINTS
# ---------------------------------------------------------
@router.post("/ai/chat")
async def chat_endpoint(req: dict, user: dict = Depends(get_current_user)):
    history = [{"role": m['role'], "content": m['content']} for m in req.get('history', [])]
    response = ai_service.chat_with_user(history, req.get('message', ''))
    
    if response["action"] == "generate":
        req_data = response["data"]
        gen_req = ai_schemas.AIGenerationRequest(
            full_name=req_data.get("full_name", "User"),
            email=user.get("email", ""),
            desired_job_title=req_data.get("desired_job_title", ""),
            top_skills=req_data.get("top_skills", []),
            experience_level=req_data.get("experience_level", ""),
            personal_strengths=req_data.get("professional_summary", "")
        )
        cv_data = ai_service.generate_cv_content_from_ai(gen_req)
        if cv_data.success:
            return {"reply": response["reply"], "action": "generate", "cv_data": cv_data.data}
            
    return response

@router.post("/ai/upload-resume")
async def upload_endpoint(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = await file.read()
    fname = str(file.filename) if file.filename else "resume.pdf"
    text = parser_service.extract_text(content, fname)
    return {"success": True, "extracted_text": text}

# ---------------------------------------------------------
# CV ENDPOINTS
# ---------------------------------------------------------
@router.post("/cvs")
def create_cv_endpoint(payload: Dict[str, Any], db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """
    Creates a new CV.
    """
    raw_data = payload.get("data", {})
    clean_dict = normalize_cv_dict(raw_data)
    
    try:
        cv_data_obj = cv_schemas.CVData(**clean_dict)
    except Exception as e:
        logger.error(f"Validation Error: {e}")
        raise HTTPException(status_code=422, detail=f"Invalid Data Structure: {str(e)}")

    cv_in = cv_schemas.CVCreate(
        title=payload.get("title", "My New CV"),
        template_id=payload.get("template_id", "modern"),
        data=cv_data_obj
    )
    
    user_id = int(user["user_id"])
    created_cv = cv_crud.create_cv(db, cv_in, user_id)
    return camelize_cv_record(created_cv) # Camelized for React


@router.get("/cvs")
def list_cvs_endpoint(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """
    List all CVs for the authenticated user.
    """
    db_cvs = cv_crud.get_all_user_cvs(db, int(user["user_id"]))
    return [camelize_cv_record(cv) for cv in db_cvs] # Camelized for React


@router.get("/cvs/{cv_id}")
def get_cv_endpoint(cv_id: int, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """
    Get a single CV by ID
    """
    db_cv = cv_crud.get_cv(db, cv_id, int(user["user_id"]))
    if not db_cv:
        raise HTTPException(status_code=404, detail="CV not found")
    return camelize_cv_record(db_cv) # Camelized for React


@router.put("/cvs/{cv_id}")
def update_cv_endpoint(cv_id: int, payload: Dict[str, Any], db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """
    Updates an existing CV
    """
    logger.info(f"📝 UPDATE CV Request: cv_id={cv_id}, user={user['user_id']}")
    
    raw_data = payload.get("data", {})
    clean_dict = normalize_cv_dict(raw_data)
    
    try:
        cv_data_obj = cv_schemas.CVData(**clean_dict)
    except Exception as e:
        logger.error(f"Validation Error: {e}")
        raise HTTPException(status_code=422, detail=f"Invalid Data Structure: {str(e)}")

    cv_update = cv_schemas.CVUpdate(
        title=payload.get("title"),
        template_id=payload.get("template_id"),
        data=cv_data_obj
    )
    
    user_id = int(user["user_id"])
    updated_cv = cv_crud.update_cv(db, cv_id, cv_update, user_id)
    
    if not updated_cv:
        raise HTTPException(status_code=404, detail="CV not found or you don't have permission")
    
    logger.info(f"✅ CV Updated: id={cv_id}, template={updated_cv.template_id}")
    return camelize_cv_record(updated_cv) # Camelized for React

@router.delete("/cvs/{cv_id}")
def delete_cv_endpoint(cv_id: int, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """
    Delete a CV
    """
    success = cv_crud.delete_cv(db, cv_id, int(user["user_id"]))
    if not success:
        raise HTTPException(status_code=404, detail="CV not found")
    return {"success": True, "message": "CV deleted"}

@router.get("/cvs/{cv_id}/export/{type}")
def export_endpoint(cv_id: int, type: str, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    db_cv = cv_crud.get_cv(db, int(cv_id), int(user["user_id"]))
    if not db_cv:
        raise HTTPException(404, "CV not found")

    data_source = db_cv.data
    if hasattr(data_source, "model_dump"):
        cv_dict = data_source.model_dump()
    elif hasattr(data_source, "dict"):
        cv_dict = data_source.dict()
    else:
        cv_dict = dict(data_source) # type: ignore

    # Ensure we have a Dict[str, Any] and decode any bytes keys/values that may exist.
    def _ensure_str_keys(o: Any) -> Any:
        if isinstance(o, dict):
            new = {}
            for k, v in o.items():
                if isinstance(k, (bytes, bytearray)):
                    try:
                        key = k.decode("utf-8")
                    except Exception:
                        key = k.decode("latin-1", errors="ignore")
                else:
                    key = k if isinstance(k, str) else str(k)
                new[key] = _ensure_str_keys(v)
            return new
        if isinstance(o, list):
            return [_ensure_str_keys(i) for i in o]
        if isinstance(o, (bytes, bytearray)):
            try:
                return o.decode("utf-8")
            except Exception:
                return o.decode("latin-1", errors="ignore")
        return o

    try:
        if not isinstance(cv_dict, dict):
            cv_dict = dict(cv_dict)  # type: ignore
    except Exception:
        cv_dict = {}

    cv_dict = _ensure_str_keys(cv_dict)

    template_id_str = str(db_cv.template_id)
    tmpl = template_crud.get_template(db, template_id_str)
    if not tmpl: 
        tmpl = template_crud.get_template(db, "modern")

    if not tmpl: raise HTTPException(404, "Default Template missing")

    if type == 'pdf':
        pdf_bytes = file_service.create_pdf_from_template(cast(str, tmpl.html_content), cast(str, tmpl.css_styles), cv_dict)
        return Response(content=pdf_bytes, media_type="application/pdf")
            
    elif type == 'html':
        full_html = render_template_internal(cast(str, tmpl.html_content), cast(str, tmpl.css_styles), cv_dict)
        return Response(content=full_html, media_type="text/html")
        
    elif type == 'docx':
        clean_docx_data = normalize_cv_dict(cv_dict)
        docx_bytes = file_service.create_docx_from_data(clean_docx_data)
        filename = "resume.docx"
        return Response(
            content=docx_bytes, 
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    raise HTTPException(400, "Unknown format")

@router.post("/generate-pdf")
def generate_pdf_direct(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Direct Preview endpoint for frontend live preview.
    """
    raw_data = payload.get("data", {})
    t_id = payload.get("template_id", "modern")
    
    tmpl = template_crud.get_template(db, str(t_id))
    if not tmpl: 
        tmpl = template_crud.get_template(db, "modern")

    if tmpl:
        full_html = render_template_internal(cast(str, tmpl.html_content), cast(str, tmpl.css_styles), raw_data)
        return Response(content=full_html, media_type="text/html")
    
    return Response(content="<h1>Template Error</h1>", media_type="text/html")

# ---------------------------------------------------------
# TEMPLATE ENDPOINTS
# ---------------------------------------------------------
@router.get("/templates", response_model=List[template_schemas.Template])
def get_templates(db: Session = Depends(get_db)):
    return template_crud.get_all_templates(db)

@router.get("/templates/{id}", response_model=template_schemas.TemplateFull)
def get_single_template(id: str, db: Session = Depends(get_db)):
    t = template_crud.get_template(db, id)
    if not t: raise HTTPException(404, "Template not found")
    return t

@router.delete("/admin/templates/{template_id}")
def delete_template_endpoint(
    template_id: str, 
    db: Session = Depends(get_db), 
    user: dict = Depends(get_current_user)
):
    """
    Delete a template (Admin only)
    """
    # Check if user is admin
    if user.get("email") != config.settings.ADMIN_EMAIL:
        raise HTTPException(403, "Admin Access Required")
    
    # Get the template
    template = template_crud.get_template(db, template_id)
    if not template:
        raise HTTPException(404, "Template not found")
    
    # Delete the template
    try:
        db.delete(template)
        db.commit()
        return {"success": True, "message": f"Template {template_id} deleted"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to delete template: {str(e)}")
    
@router.post("/admin/templates", response_model=template_schemas.Template)
def admin_create(t: template_schemas.TemplateCreate, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    if user.get("email") != config.settings.ADMIN_EMAIL: 
        raise HTTPException(403, "Admin Access Required")
    
    exist = template_crud.get_template(db, t.id)
    if exist:
        update_data = template_schemas.TemplateUpdate(
            name=t.name,
            category=t.category,
            is_premium=t.is_premium,
            html_content=t.html_content,
            css_styles=t.css_styles
        )
        return template_crud.update_template(db, exist, update_data)
    
    return template_crud.create_template(db, t)
@router.put("/admin/templates/{template_id}", response_model=template_schemas.Template)
def admin_update_template(
    template_id: str,
    t: template_schemas.TemplateUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """
    PUT Endpoint to handle template updates directly from the Admin Panel
    """
    if user.get("email") != config.settings.ADMIN_EMAIL: 
        raise HTTPException(403, "Admin Access Required")
        
    exist = template_crud.get_template(db, template_id)
    if not exist:
        raise HTTPException(404, "Template not found")
        
    return template_crud.update_template(db, exist, t)
# ==========================================
# ⚡ SUPER SETUP ROUTE (Schema Migration + Seeding)
# ==========================================
from sqlalchemy import text

@router.get("/setup_production")
def setup_production_db(db: Session = Depends(get_db)):
    # Dynamically import database and engine to build missing tables
    from .database import Base, engine
    from .models.template import Template
    from .models.package import Package
    
    log = []
    
    # 0. REBUILD TABLES (Wipes old schema drift completely)
    try:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        log.append("✅ Database tables cleanly rebuilt from scratch.")
    except Exception as e:
        log.append(f"❌ Table creation failed: {e}")
    
    # 1. MIGRATE SCHEMA (Add 'credits' if missing)
    try:
        check = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='credits'"))
        if not check.fetchone():
            db.execute(text("ALTER TABLE users ADD COLUMN credits INTEGER DEFAULT 3"))
            db.commit()
            log.append("✅ Migrated: Added credits wallet.")
        else:
            log.append("ℹ️ Wallet ready.")
    except Exception as e:
        log.append(f"⚠️ Schema migration: {e}")

    # 2. SEED PACKAGES
    try:
        if db.query(Package).count() == 0:
            seed_pkgs = [
                Package(name="Quick Start", price_usd=250.0, credits=1, description="One single download", badge="BASIC", stripe_payment_link="#"),
                Package(name="Pro Career", price_usd=1500.0, credits=10, description="Unlimited edits 1 mo", badge="POPULAR", stripe_payment_link="#"),
            ]
            db.add_all(seed_pkgs)
            db.commit()
            log.append("✅ Seeded Money Packages.")
    except Exception as e:
        db.rollback()
        log.append(f"❌ Package Error: {e}")

    # 3. SEED TEMPLATES (Both classic and modern updated with has_ guards & single loops)
    templates_data = [
        {
            "id": "tech_minimal", "name": "Tech Minimal", "category": "creative", "is_premium": True,
            "html": "<div class='resume-tech'><div class='tech-main'><h1>{{full_name}}</h1><div class='role-tag'>{{job_title}}</div><div class='t-sec'><div class='s-head'>> Summary</div><p>{{{summary}}}</p></div><div class='t-sec'><div class='s-head'>> Log</div><div class='code'>{{{experience}}}</div></div><div class='t-sec'><div class='s-head'>> Education</div><div class='code'>{{{education}}}</div></div>{{#has_certifications}}<div class='t-sec'><div class='s-head'>> Certifications</div><ul>{{#certifications}}<li>{{.}}</li>{{/certifications}}</ul></div>{{/has_certifications}}</div><div class='tech-sidebar'>{{#profile_image}}<img src='{{profile_image}}'/>{{/profile_image}}<h4>Connect</h4><p>{{email}}</p><p>{{phone}}</p>{{#location}}<p>📍 {{location}}</p>{{/location}}{{#linkedin}}<p class='link'>🔗 LinkedIn</p>{{/linkedin}}{{#github}}<p class='link'>💻 GitHub</p>{{/github}}{{#portfolio}}<p class='link'>🌐 Portfolio</p>{{/portfolio}}{{#has_skills}}<h4>Stack</h4>{{#skills}}<div class='t-skill'>{{.}}</div>{{/skills}}{{/has_skills}}{{#has_languages}}<h4>Languages</h4>{{#languages}}<div class='t-skill'>{{.}}</div>{{/languages}}{{/has_languages}}{{#has_hobbies}}<h4>Interests</h4>{{#hobbies}}<div class='t-skill'>{{.}}</div>{{/hobbies}}{{/has_hobbies}}</div></div>",
            "css": ".resume-tech{display:flex;font-family:'Courier New',monospace;min-height:1000px;background:#0d1117;color:#c9d1d9}.tech-main{width:65%;padding:40px;border-right:1px solid #30363d}.tech-sidebar{width:35%;padding:30px;background:#161b22}.role-tag{display:inline-block;background:#21262d;border:1px solid #30363d;padding:4px 12px;border-radius:20px;font-size:13px;color:#58a6ff;margin-bottom:30px}.t-sec{margin-bottom:25px}.s-head{color:#58a6ff;font-weight:bold;margin-bottom:10px;font-size:14px}.code{font-size:13px;line-height:1.7;color:#8b949e}h1{color:#e6edf3;font-size:28px;margin:0 0 10px 0}h4{color:#58a6ff;font-size:12px;text-transform:uppercase;margin:20px 0 8px 0;border-bottom:1px solid #30363d;padding-bottom:4px}.t-skill{background:#21262d;border:1px solid #30363d;padding:3px 8px;border-radius:4px;font-size:12px;margin-bottom:4px;color:#c9d1d9}.link{color:#58a6ff;font-size:13px}p{font-size:13px;margin:4px 0;color:#8b949e}ul{padding-left:18px}li{font-size:13px;color:#c9d1d9;margin-bottom:4px}"
        },
        {
            "id": "ivy_league", "name": "Ivy League", "category": "professional", "is_premium": True,
            "html": "<div class='resume-ivy'><div class='ivy-header'><h1>{{full_name}}</h1><div class='subtitle'>{{job_title}}</div><div class='ivy-contact'>{{email}} • {{phone}}{{#location}} • {{location}}{{/location}}</div></div><div class='ivy-body'>{{#profile_image}}<div class='photo-c'><img src='{{profile_image}}'/></div>{{/profile_image}}<div class='stitle'>Professional Summary</div><div class='content'>{{{summary}}}</div><div class='stitle'>Experience</div><div class='content'>{{{experience}}}</div><div class='stitle'>Education</div><div class='content'>{{{education}}}</div>{{#has_skills}}<div class='stitle'>Skills</div><div class='sgrid'>{{#skills}}<span>{{.}}</span>{{/skills}}</div>{{/has_skills}}{{#has_languages}}<div class='stitle'>Languages</div><div class='sgrid'>{{#languages}}<span>{{.}}</span>{{/languages}}</div>{{/has_languages}}{{#has_certifications}}<div class='stitle'>Certifications</div><ul>{{#certifications}}<li>{{.}}</li>{{/certifications}}</ul>{{/has_certifications}}{{#has_hobbies}}<div class='stitle'>Interests</div><div class='sgrid'>{{#hobbies}}<span>{{.}}</span>{{/hobbies}}</div>{{/has_hobbies}}</div></div>",
            "css": ".resume-ivy{font-family:Georgia,serif;padding:50px;background:white;color:#1a1a1a;min-height:1000px}.ivy-header{text-align:center;border-bottom:3px double #1a1a1a;padding-bottom:20px;margin-bottom:30px}.ivy-header h1{font-size:32px;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px 0}.subtitle{font-size:16px;font-style:italic;color:#444;margin-bottom:8px}.ivy-contact{font-size:13px;color:#555}.stitle{font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;border-bottom:1px solid #1a1a1a;padding-bottom:4px;margin:25px 0 10px 0}.content{font-size:14px;line-height:1.7;color:#333}.sgrid{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}.sgrid span{border:1px solid #999;padding:2px 10px;font-size:13px;border-radius:2px}.photo-c img{width:100px;height:100px;border-radius:50%;float:right;margin:0 0 10px 15px;object-fit:cover;border:2px solid #1a1a1a}ul{padding-left:20px}li{font-size:14px;margin-bottom:4px}"
        },
        {
            "id": "modern", "name": "Modern Blue", "category": "professional", "is_premium": False,
            "html": "<div class='resume-modern'><div class='sidebar'><div class='profile-container'>{{#profile_image}}<img src='{{profile_image}}' class='profile-img'/>{{/profile_image}}<h1>{{full_name}}</h1><p class='job-title'>{{job_title}}</p></div><div class='contact-box'><div class='label'>Contact</div><div class='value'>{{email}}</div><div class='value'>{{phone}}</div>{{#location}}<div class='value'>{{location}}</div>{{/location}}</div>{{#has_skills}}<div class='skills-box'><div class='label'>Skills</div><ul>{{#skills}}<li>{{.}}</li>{{/skills}}</ul></div>{{/has_skills}}{{#has_languages}}<div class='skills-box'><div class='label'>Languages</div><ul>{{#languages}}<li>{{.}}</li>{{/languages}}</ul></div>{{/has_languages}}{{#has_certifications}}<div class='skills-box'><div class='label'>Certifications</div><ul>{{#certifications}}<li>{{.}}</li>{{/certifications}}</ul></div>{{/has_certifications}}{{#has_hobbies}}<div class='skills-box'><div class='label'>Hobbies</div><ul>{{#hobbies}}<li>{{.}}</li>{{/hobbies}}</ul></div>{{/has_hobbies}}</div><div class='main-content'><div class='section'><h2>Profile</h2><div class='text'>{{{summary}}}</div></div><div class='section'><h2>Experience</h2><div class='text history-list'>{{{experience}}}</div></div><div class='section'><h2>Education</h2><div class='text history-list'>{{{education}}}</div></div></div></div>",
            "css": ".resume-modern{display:flex;font-family:sans-serif;height:100%;min-height:1000px;background:white;color:#333}.sidebar{width:35%;background:var(--primary, #2c3e50);color:white;padding:30px 20px;text-align:center}.main-content{width:65%;padding:30px}.profile-img{width:120px;height:120px;border-radius:50%;border:4px solid rgba(255,255,255,0.2);object-fit:cover;margin-bottom:10px}h1{font-size:22px;margin:10px 0 5px 0;text-transform:uppercase}.job-title{font-size:14px;opacity:0.9;margin-bottom:30px}.label{font-weight:bold;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:5px;margin:20px 0 10px 0;font-size:12px}.skills-box li{background:rgba(0,0,0,0.2);margin-bottom:5px;padding:5px;border-radius:3px;font-size:12px}h2{color:var(--primary, #2c3e50);border-bottom:2px solid var(--primary, #2c3e50);padding-bottom:5px;text-transform:uppercase;margin-top:0}.text{font-size:14px;line-height:1.6;margin-bottom:20px} .history-list p { margin:5px 0; }"
        },
        {
            "id": "classic", "name": "Classic Clean", "category": "simple", "is_premium": False,
            "html": "<div class='resume-classic'><div class='header'><h1>{{full_name}}</h1><p>{{job_title}}</p><p class='contact'>{{email}} | {{phone}}{{#location}} | {{location}}{{/location}}</p></div><hr/><h3>Professional Summary</h3><p class='summary'>{{{summary}}}</p>{{#has_skills}}<h3>Skills</h3><div class='skills-grid'>{{#skills}}<span class='skill-item'>{{.}}</span>{{/skills}}</div>{{/has_skills}}<h3>Experience</h3><div class='content'>{{{experience}}}</div><h3>Education</h3><div class='content'>{{{education}}}</div>{{#has_languages}}<h3>Languages</h3><div class='skills-grid'>{{#languages}}<span class='skill-item'>{{.}}</span>{{/languages}}</div>{{/has_languages}}{{#has_certifications}}<h3>Certifications</h3><div class='skills-grid'>{{#certifications}}<span class='skill-item'>{{.}}</span>{{/certifications}}</div>{{/has_certifications}}{{#has_hobbies}}<h3>Hobbies / Interests</h3><div class='skills-grid'>{{#hobbies}}<span class='skill-item'>{{.}}</span>{{/hobbies}}</div>{{/has_hobbies}}</div>",
            "css": ".resume-classic{font-family:'Times New Roman',serif;padding:40px;background:white;color:#000;min-height:1000px}.header{text-align:center;margin-bottom:20px}h1{margin:0;font-size:28px;text-transform:uppercase;letter-spacing:2px}.header p{margin:5px 0;font-style:italic}h3{background:#f0f0f0;padding:5px 10px;text-transform:uppercase;font-size:14px;font-weight:bold;border-left:5px solid #333;margin-top:20px}.skills-grid{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px}.skill-item{border:1px solid #333;padding:3px 8px;font-size:13px}ul{padding-left:20px}"
        },
        {
            "id": "startup_bold", "name": "Startup Bold", "category": "creative", "is_premium": True,
            "html": "<div class='resume-start'><div class='start-sidebar'><h1>{{full_name}}</h1><h3>{{job_title}}</h3>{{#profile_image}}<div class='start-img-container'><img src='{{profile_image}}'/></div>{{/profile_image}}<div class='start-group'><div class='start-label'>Contact</div><div>{{email}}</div><div>{{phone}}</div></div>{{#has_skills}}<div class='start-group'><div class='start-label'>Skills</div><div class='tag-cloud'>{{#skills}}<span class='tag'>{{.}}</span>{{/skills}}</div></div>{{/has_skills}}{{#has_languages}}<div class='start-group'><div class='start-label'>Languages</div><div class='tag-cloud'>{{#languages}}<span class='tag'>{{.}}</span>{{/languages}}</div></div>{{/has_languages}}{{#has_certifications}}<div class='start-group'><div class='start-label'>Certifications</div><div class='tag-cloud'>{{#certifications}}<span class='tag'>{{.}}</span>{{/certifications}}</div></div>{{/has_certifications}}{{#has_hobbies}}<div class='start-group'><div class='start-label'>Hobbies</div><div class='tag-cloud'>{{#hobbies}}<span class='tag'>{{.}}</span>{{/hobbies}}</div></div>{{/has_hobbies}}</div><div class='start-body'><h2 class='shadow-head'>Profile</h2><div class='content'>{{{summary}}}</div><h2 class='shadow-head'>Experience</h2><div class='content'>{{{experience}}}</div><h2 class='shadow-head'>Education</h2><div class='content'>{{{education}}}</div></div></div>",
            "css": ":root{--primary: {{accent_color}};} .resume-start{display:flex;font-family:sans-serif;min-height:1000px;background:#fff;width:100%;overflow:hidden;position:relative}.start-sidebar{width:35%;background:#111;color:white;padding:40px 20px;text-align:center}.start-body{width:65%;padding:40px;position:relative}.start-img-container img{width:150px!important;height:150px!important;border-radius:50%;border:4px solid var(--primary);object-fit:cover;margin:0 auto 30px;display:block}.start-label{font-size:11px;text-transform:uppercase;color:#888;border-bottom:1px solid #333;margin-bottom:5px}.tag{display:inline-block;background:#333;padding:4px 8px;border-radius:4px;margin:2px;font-size:11px}.shadow-head{font-size:24px;color:#333;text-transform:uppercase;font-weight:800;border-left:5px solid var(--primary);padding-left:15px;margin:0 0 20px}.blob{position:absolute;top:-50px;right:-50px;width:200px;height:200px;background:var(--primary);border-radius:50%;opacity:0.1}"
        }
    ]

    try:
        for data in templates_data:
            existing = db.query(Template).filter(Template.id == data["id"]).first()
            if not existing:
                db.add(Template(
                    id=data["id"],
                    name=data["name"],
                    category=data["category"],
                    is_premium=data["is_premium"],
                    html_content=data["html"],
                    css_styles=data["css"]
                ))
                log.append(f"➕ Template {data['name']} added.")
            else:
                existing.html_content = data["html"]
                existing.css_styles = data["css"]
                log.append(f"🔄 Template {data['name']} updated.")
        db.commit()
    except Exception as e:
        db.rollback()
        log.append(f"❌ Seeding process error: {e}")
        
    return {"status": "success", "logs": log}

# ==========================================
# SAFE TEMPLATE-ONLY FIX (no data wipe)
# ==========================================
@router.get("/fix_templates")
def fix_templates(db: Session = Depends(get_db)):
    """Safely updates ONLY template HTML/CSS in the DB. Never touches user data."""
    from .models.template import Template
    log = []

    templates_data = [
        {
            "id": "modern", "name": "Modern Blue", "category": "professional", "is_premium": False,
            "html": "<div class='resume-modern'><div class='sidebar'><div class='profile-container'>{{#profile_image}}<img src='{{profile_image}}' class='profile-img'/>{{/profile_image}}<h1>{{full_name}}</h1><p class='job-title'>{{job_title}}</p></div><div class='contact-box'><div class='label'>Contact</div><div class='value'>{{email}}</div><div class='value'>{{phone}}</div>{{#location}}<div class='value'>{{location}}</div>{{/location}}</div>{{#has_skills}}<div class='skills-box'><div class='label'>Skills</div><ul>{{#skills}}<li>{{.}}</li>{{/skills}}</ul></div>{{/has_skills}}{{#has_languages}}<div class='skills-box'><div class='label'>Languages</div><ul>{{#languages}}<li>{{.}}</li>{{/languages}}</ul></div>{{/has_languages}}{{#has_certifications}}<div class='skills-box'><div class='label'>Certifications</div><ul>{{#certifications}}<li>{{.}}</li>{{/certifications}}</ul></div>{{/has_certifications}}{{#has_hobbies}}<div class='skills-box'><div class='label'>Hobbies</div><ul>{{#hobbies}}<li>{{.}}</li>{{/hobbies}}</ul></div>{{/has_hobbies}}</div><div class='main-content'><div class='section'><h2>Profile</h2><div class='text'>{{{summary}}}</div></div><div class='section'><h2>Experience</h2><div class='text history-list'>{{{experience}}}</div></div><div class='section'><h2>Education</h2><div class='text history-list'>{{{education}}}</div></div></div></div>",
            "css": ".resume-modern{display:flex;font-family:sans-serif;height:100%;min-height:1000px;background:white;color:#333}.sidebar{width:35%;background:var(--primary, #2c3e50);color:white;padding:30px 20px;text-align:center}.main-content{width:65%;padding:30px}.profile-img{width:120px;height:120px;border-radius:50%;border:4px solid rgba(255,255,255,0.2);object-fit:cover;margin-bottom:10px}h1{font-size:22px;margin:10px 0 5px 0;text-transform:uppercase}.job-title{font-size:14px;opacity:0.9;margin-bottom:30px}.label{font-weight:bold;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:5px;margin:20px 0 10px 0;font-size:12px}.skills-box li{background:rgba(0,0,0,0.2);margin-bottom:5px;padding:5px;border-radius:3px;font-size:12px}h2{color:var(--primary, #2c3e50);border-bottom:2px solid var(--primary, #2c3e50);padding-bottom:5px;text-transform:uppercase;margin-top:0}.text{font-size:14px;line-height:1.6;margin-bottom:20px}.history-list p{margin:5px 0}"
        },
        {
            "id": "classic", "name": "Classic Clean", "category": "simple", "is_premium": False,
            "html": "<div class='resume-classic'><div class='header'><h1>{{full_name}}</h1><p>{{job_title}}</p><p class='contact'>{{email}} | {{phone}}{{#location}} | {{location}}{{/location}}</p></div><hr/><h3>Professional Summary</h3><p class='summary'>{{{summary}}}</p>{{#has_skills}}<h3>Skills</h3><div class='skills-grid'>{{#skills}}<span class='skill-item'>{{.}}</span>{{/skills}}</div>{{/has_skills}}<h3>Experience</h3><div class='content'>{{{experience}}}</div><h3>Education</h3><div class='content'>{{{education}}}</div>{{#has_languages}}<h3>Languages</h3><div class='skills-grid'>{{#languages}}<span class='skill-item'>{{.}}</span>{{/languages}}</div>{{/has_languages}}{{#has_certifications}}<h3>Certifications</h3><div class='skills-grid'>{{#certifications}}<span class='skill-item'>{{.}}</span>{{/certifications}}</div>{{/has_certifications}}{{#has_hobbies}}<h3>Hobbies / Interests</h3><div class='skills-grid'>{{#hobbies}}<span class='skill-item'>{{.}}</span>{{/hobbies}}</div>{{/has_hobbies}}</div>",
            "css": ".resume-classic{font-family:'Times New Roman',serif;padding:40px;background:white;color:#000;min-height:1000px}.header{text-align:center;margin-bottom:20px}h1{margin:0;font-size:28px;text-transform:uppercase;letter-spacing:2px}.header p{margin:5px 0;font-style:italic}h3{background:#f0f0f0;padding:5px 10px;text-transform:uppercase;font-size:14px;font-weight:bold;border-left:5px solid #333;margin-top:20px}.skills-grid{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px}.skill-item{border:1px solid #333;padding:3px 8px;font-size:13px}ul{padding-left:20px}"
        },
        {
            "id": "startup_bold", "name": "Startup Bold", "category": "creative", "is_premium": True,
            "html": "<div class='resume-start'><div class='start-sidebar'><h1>{{full_name}}</h1><h3>{{job_title}}</h3>{{#profile_image}}<div class='start-img-container'><img src='{{profile_image}}'/></div>{{/profile_image}}<div class='start-group'><div class='start-label'>Contact</div><div>{{email}}</div><div>{{phone}}</div></div>{{#has_skills}}<div class='start-group'><div class='start-label'>Skills</div><div class='tag-cloud'>{{#skills}}<span class='tag'>{{.}}</span>{{/skills}}</div></div>{{/has_skills}}{{#has_languages}}<div class='start-group'><div class='start-label'>Languages</div><div class='tag-cloud'>{{#languages}}<span class='tag'>{{.}}</span>{{/languages}}</div></div>{{/has_languages}}{{#has_certifications}}<div class='start-group'><div class='start-label'>Certifications</div><div class='tag-cloud'>{{#certifications}}<span class='tag'>{{.}}</span>{{/certifications}}</div></div>{{/has_certifications}}{{#has_hobbies}}<div class='start-group'><div class='start-label'>Hobbies</div><div class='tag-cloud'>{{#hobbies}}<span class='tag'>{{.}}</span>{{/hobbies}}</div></div>{{/has_hobbies}}</div><div class='start-body'><h2 class='shadow-head'>Profile</h2><div class='content'>{{{summary}}}</div><h2 class='shadow-head'>Experience</h2><div class='content'>{{{experience}}}</div><h2 class='shadow-head'>Education</h2><div class='content'>{{{education}}}</div></div></div>",
            "css": ":root{--primary: {{accent_color}};} .resume-start{display:flex;font-family:sans-serif;min-height:1000px;background:#fff;width:100%;overflow:hidden;position:relative}.start-sidebar{width:35%;background:#111;color:white;padding:40px 20px;text-align:center}.start-body{width:65%;padding:40px;position:relative}.start-img-container img{width:150px!important;height:150px!important;border-radius:50%;border:4px solid var(--primary);object-fit:cover;margin:0 auto 30px;display:block}.start-label{font-size:11px;text-transform:uppercase;color:#888;border-bottom:1px solid #333;margin-bottom:5px}.tag{display:inline-block;background:#333;padding:4px 8px;border-radius:4px;margin:2px;font-size:11px}.shadow-head{font-size:24px;color:#333;text-transform:uppercase;font-weight:800;border-left:5px solid var(--primary);padding-left:15px;margin:0 0 20px}.blob{position:absolute;top:-50px;right:-50px;width:200px;height:200px;background:var(--primary);border-radius:50%;opacity:0.1}"
        },
    ]

    try:
        for t in templates_data:
            existing = db.query(Template).filter(Template.id == t["id"]).first()
            if existing:
                existing.html_content = t["html"]
                existing.css_styles   = t["css"]
                log.append(f"✅ Updated: {t['name']}")
            else:
                db.add(Template(
                    id=t["id"], name=t["name"], category=t["category"],
                    is_premium=t["is_premium"],
                    html_content=t["html"], css_styles=t["css"]
                ))
                log.append(f"➕ Inserted: {t['name']}")
        db.commit()
    except Exception as e:
        db.rollback()
        log.append(f"❌ Error: {e}")

    return {"status": "success", "logs": log}


# Package CRUD endpoints
@router.get("/admin/packages")
def get_packages(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    if user.get("email") != config.settings.ADMIN_EMAIL: 
        raise HTTPException(403, "Admin only")
    return db.query(Package).all()

@router.post("/admin/packages")
def create_package(pkg: dict, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    if user.get("email") != config.settings.ADMIN_EMAIL: 
        raise HTTPException(403, "Admin only")
    new_pkg = Package(**pkg)
    db.add(new_pkg)
    db.commit()
    db.refresh(new_pkg)
    return new_pkg

@router.put("/admin/packages/{pkg_id}")
def update_package(pkg_id: int, pkg: dict, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    if user.get("email") != config.settings.ADMIN_EMAIL: 
        raise HTTPException(403, "Admin only")
    db_pkg = db.query(Package).filter(Package.id == pkg_id).first()
    if not db_pkg: raise HTTPException(404)
    for key, val in pkg.items():
        setattr(db_pkg, key, val)
    db.commit()
    return db_pkg

@router.delete("/admin/packages/{pkg_id}")
def delete_package(pkg_id: int, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    if user.get("email") != config.settings.ADMIN_EMAIL: 
        raise HTTPException(403, "Admin only")
    db.query(Package).filter(Package.id == pkg_id).delete()
    db.commit()
    return {"success": True}

# Payment instructions endpoints
@router.get("/admin/payment-instructions")
def get_instructions(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    # Store in a settings table or return from config
    return {"instructions": ""}

@router.post("/admin/payment-instructions")
def save_instructions(data: dict, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    # Save to settings table
    return {"success": True}