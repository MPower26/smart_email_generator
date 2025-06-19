from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime

from app.db.database import get_db
from app.models.models import EmailTemplate, User
from app.api.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[Dict[str, Any]])
async def get_templates(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get templates for the current user, optionally filtered by category"""
    query = db.query(EmailTemplate).filter(EmailTemplate.user_id == current_user.id)
    
    if category:
        if category not in ["outreach", "followup", "lastchance"]:
            raise HTTPException(status_code=400, detail="Invalid category. Must be one of: outreach, followup, lastchance")
        query = query.filter(EmailTemplate.category == category)
    
    templates = query.all()
    result = []
    for template in templates:
        result.append({
            "id": template.id,
            "name": template.name,
            "content": template.content,
            "is_default": template.is_default,
            "category": template.category,
            "created_at": template.created_at.isoformat() if template.created_at else None,
            "updated_at": template.updated_at.isoformat() if template.updated_at else None
        })
    return result

@router.get("/by-category", response_model=Dict[str, List[Dict[str, Any]]])
async def get_templates_by_category(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get templates organized by category"""
    templates = db.query(EmailTemplate).filter(EmailTemplate.user_id == current_user.id).all()
    
    result = {
        "outreach": [],
        "followup": [],
        "lastchance": []
    }
    
    for template in templates:
        template_dict = {
            "id": template.id,
            "name": template.name,
            "content": template.content,
            "is_default": template.is_default,
            "category": template.category,
            "created_at": template.created_at.isoformat() if template.created_at else None,
            "updated_at": template.updated_at.isoformat() if template.updated_at else None
        }
        result[template.category].append(template_dict)
    
    return result

@router.get("/default/{category}", response_model=Optional[Dict[str, Any]])
async def get_default_template(
    category: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the default template for a specific category"""
    if category not in ["outreach", "followup", "lastchance"]:
        raise HTTPException(status_code=400, detail="Invalid category. Must be one of: outreach, followup, lastchance")
    
    template = db.query(EmailTemplate).filter(
        EmailTemplate.user_id == current_user.id,
        EmailTemplate.category == category,
        EmailTemplate.is_default == True
    ).first()
    
    if not template:
        return None
    
    return {
        "id": template.id,
        "name": template.name,
        "content": template.content,
        "is_default": template.is_default,
        "category": template.category,
        "created_at": template.created_at.isoformat() if template.created_at else None,
        "updated_at": template.updated_at.isoformat() if template.updated_at else None
    }

@router.post("/", response_model=Dict[str, Any])
async def create_template(
    template_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new template"""
    name = template_data.get("name")
    content = template_data.get("content")
    category = template_data.get("category", "outreach")
    is_default = template_data.get("is_default", False)
    
    if not name or not content:
        raise HTTPException(status_code=400, detail="Name and content are required")
    
    if category not in ["outreach", "followup", "lastchance"]:
        raise HTTPException(status_code=400, detail="Invalid category. Must be one of: outreach, followup, lastchance")
    
    # Check if user already has 3 templates in this category
    existing_count = db.query(EmailTemplate).filter(
        EmailTemplate.user_id == current_user.id,
        EmailTemplate.category == category
    ).count()
    
    if existing_count >= 3:
        raise HTTPException(status_code=400, detail=f"Maximum of 3 templates allowed per category. You already have {existing_count} templates in the '{category}' category.")
    
    # If setting as default, unset previous default in this category
    if is_default:
        db.query(EmailTemplate).filter(
            EmailTemplate.user_id == current_user.id,
            EmailTemplate.category == category,
            EmailTemplate.is_default == True
        ).update({"is_default": False})
    
    template = EmailTemplate(
        name=name,
        content=content,
        category=category,
        is_default=is_default,
        user_id=current_user.id
    )
    
    db.add(template)
    db.commit()
    db.refresh(template)
    
    return {
        "id": template.id,
        "name": template.name,
        "content": template.content,
        "is_default": template.is_default,
        "category": template.category,
        "created_at": template.created_at.isoformat() if template.created_at else None,
        "updated_at": template.updated_at.isoformat() if template.updated_at else None
    }

@router.put("/{template_id}", response_model=Dict[str, Any])
async def update_template(
    template_id: int,
    template_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing template"""
    template = db.query(EmailTemplate).filter(
        EmailTemplate.id == template_id,
        EmailTemplate.user_id == current_user.id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Update fields if provided
    if "name" in template_data:
        template.name = template_data["name"]
    if "content" in template_data:
        template.content = template_data["content"]
    if "category" in template_data:
        new_category = template_data["category"]
        if new_category not in ["outreach", "followup", "lastchance"]:
            raise HTTPException(status_code=400, detail="Invalid category. Must be one of: outreach, followup, lastchance")
        
        # If changing category, check if user already has 3 templates in the new category
        if new_category != template.category:
            existing_count = db.query(EmailTemplate).filter(
                EmailTemplate.user_id == current_user.id,
                EmailTemplate.category == new_category
            ).count()
            
            if existing_count >= 3:
                raise HTTPException(status_code=400, detail=f"Maximum of 3 templates allowed per category. You already have {existing_count} templates in the '{new_category}' category.")
        
        template.category = new_category
    
    # Handle default setting
    if "is_default" in template_data:
        is_default = template_data["is_default"]
        if is_default:
            # Unset previous default in this category
            db.query(EmailTemplate).filter(
                EmailTemplate.user_id == current_user.id,
                EmailTemplate.category == template.category,
                EmailTemplate.is_default == True,
                EmailTemplate.id != template_id
            ).update({"is_default": False})
        template.is_default = is_default
    
    template.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(template)
    
    return {
        "id": template.id,
        "name": template.name,
        "content": template.content,
        "is_default": template.is_default,
        "category": template.category,
        "created_at": template.created_at.isoformat() if template.created_at else None,
        "updated_at": template.updated_at.isoformat() if template.updated_at else None
    }

@router.put("/{template_id}/set-default", response_model=Dict[str, Any])
async def set_default_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set a template as default for its category"""
    template = db.query(EmailTemplate).filter(
        EmailTemplate.id == template_id,
        EmailTemplate.user_id == current_user.id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Unset previous default in this category
    db.query(EmailTemplate).filter(
        EmailTemplate.user_id == current_user.id,
        EmailTemplate.category == template.category,
        EmailTemplate.is_default == True
    ).update({"is_default": False})
    
    # Set this template as default
    template.is_default = True
    template.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(template)
    
    return {
        "id": template.id,
        "name": template.name,
        "content": template.content,
        "is_default": template.is_default,
        "category": template.category,
        "created_at": template.created_at.isoformat() if template.created_at else None,
        "updated_at": template.updated_at.isoformat() if template.updated_at else None
    }

@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a template"""
    template = db.query(EmailTemplate).filter(
        EmailTemplate.id == template_id,
        EmailTemplate.user_id == current_user.id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    db.delete(template)
    db.commit()
    
    return {"message": "Template deleted successfully"} 
