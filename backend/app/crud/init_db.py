
from sqlalchemy.orm import Session
from ..models import template as models
from ..core.seed_data import PERMANENT_TEMPLATES

def sync_templates(db: Session):
    print("🔄 Checking for missing templates...")
    count = 0
    for data in PERMANENT_TEMPLATES:
        existing = db.query(models.Template).filter(models.Template.id == data["id"]).first()
        if not existing:
            print(f"➕ Auto-Adding: {data['name']}")
            new_t = models.Template(**data)
            db.add(new_t)
            count += 1
        else:
            # Force update content using CORRECT keys
            existing.html_content = data["html_content"]
            existing.css_styles = data["css_styles"]
            
    db.commit()
    print(f"✅ Synced. Added {count} new templates.")
