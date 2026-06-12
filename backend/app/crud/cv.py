from sqlalchemy.orm import Session
from ..models import cv as models
from ..schemas import cv as schemas

def get_cv(db: Session, cv_id: int, user_id: int):
    # CHANGED: owner_id -> user_id
    return db.query(models.CV).filter(models.CV.id == cv_id, models.CV.user_id == user_id).first()

def get_all_user_cvs(db: Session, user_id: int):
    # CHANGED: owner_id -> user_id
    return db.query(models.CV).filter(models.CV.user_id == user_id).all()

def create_cv(db: Session, cv_schema: schemas.CVCreate, user_id: int):
    # 1. Pydantic Compatibility (V1 vs V2)
    if hasattr(cv_schema, "model_dump"):
        cv_dict = cv_schema.model_dump()
    else:
        cv_dict = cv_schema.dict()

    # 2. Extract nested data
    # Safe .get() in case data key is missing
    data_content = cv_dict.get("data", {}) 
    
    # 3. Create DB Object
    # CRITICAL FIX: we usage 'user_id=user_id', not 'owner_id'
    db_obj = models.CV(
        title=cv_dict.get("title", "My CV"),
        template_id=cv_dict.get("template_id", "modern"),
        data=data_content, 
        user_id=user_id 
    )

    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def update_cv(db: Session, cv_id: int, cv_update: schemas.CVUpdate, user_id: int):
    db_cv = get_cv(db, cv_id, user_id)
    if not db_cv:
        return None
        
    if hasattr(cv_update, "model_dump"):
        update_data = cv_update.model_dump(exclude_unset=True)
    else:
        update_data = cv_update.dict(exclude_unset=True)

    for key, value in update_data.items():
        if hasattr(db_cv, key) and value is not None:
            setattr(db_cv, key, value)
            
    db.commit()
    db.refresh(db_cv)
    return db_cv

def delete_cv(db: Session, cv_id: int, user_id: int):
    db_cv = get_cv(db, cv_id, user_id)
    if db_cv:
        db.delete(db_cv)
        db.commit()
        return True
    return False