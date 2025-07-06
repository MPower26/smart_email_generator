from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
import os
import logging
import time

from app.db.database import get_db
from app.models.models import EmailTemplate, User, Attachment
from app.api.auth import get_current_user
from app.services.blob_storage import blob_storage_service
from app.schemas.user import AttachmentOut

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
    existing_templates = db.query(EmailTemplate).filter(
        EmailTemplate.user_id == current_user.id,
        EmailTemplate.category == category
    ).all()
    existing_count = len(existing_templates)
    
    if existing_count >= 3:
        raise HTTPException(status_code=400, detail=f"Maximum of 3 templates allowed per category. You already have {existing_count} templates in the '{category}' category.")
    
    # If this is the first template for this category, force is_default True
    if existing_count == 0:
        is_default = True
    
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
            template.is_default = True
        else:
            # Prevent unsetting the only default in this category
            other_defaults = db.query(EmailTemplate).filter(
                EmailTemplate.user_id == current_user.id,
                EmailTemplate.category == template.category,
                EmailTemplate.is_default == True,
                EmailTemplate.id != template_id
            ).count()
            if other_defaults == 0:
                raise HTTPException(status_code=400, detail="There must be at least one default template per category.")
            template.is_default = False
    
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

@router.post("/attachments/upload", response_model=Dict[str, str])
async def upload_attachment(
    file: UploadFile = File(...),
    placeholder: str = Form(...),
    category: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    logger = logging.getLogger(__name__)
    
    start_time = time.time()
    
    logger.info(f"🎯 Starting attachment upload for user: {current_user.email}")
    logger.info(f"📁 File: {file.filename}")
    logger.info(f"📊 Size: {file.size} bytes ({file.size / (1024*1024):.1f} MB)")
    logger.info(f"🎬 Type: {file.content_type}")
    logger.info(f"🏷️  Placeholder: {placeholder}")
    if category:
        logger.info(f"📂 Category: {category}")
    
    # Validate file type (image/video)
    allowed_types = ["image/", "video/"]
    if not any(file.content_type.startswith(t) for t in allowed_types):
        logger.warning(f"❌ Invalid file type: {file.content_type}")
        raise HTTPException(status_code=400, detail="File must be an image or video")

    is_video = file.content_type.startswith("video/")

    # Validate file size (max 20MB)
    max_size = 20 * 1024 * 1024  # 20MB
    if file.size > max_size:
        logger.warning(f"❌ File too large: {file.size} bytes ({file.size / (1024*1024):.1f} MB) > {max_size / (1024*1024)} MB")
        raise HTTPException(status_code=400, detail="File size must be < 20MB")
    
    # Only allow one placeholder per user
    existing = db.query(Attachment).filter_by(user_id=current_user.id, placeholder=placeholder).first()
    if existing:
        logger.warning(f"❌ Placeholder already exists: {placeholder}")
        raise HTTPException(status_code=400, detail="Placeholder already exists for this user")
    
    logger.info("📖 Reading file content...")
    read_start = time.time()
    content = await file.read()
    read_duration = time.time() - read_start
    logger.info(f"✅ File content read: {len(content)} bytes in {read_duration:.2f}s")
    
    file_extension = os.path.splitext(file.filename)[1]
    logger.info(f"📝 File extension: {file_extension}")
    
    logger.info("☁️  Starting Azure Blob Storage upload...")
    blob_start = time.time()
    blob_url, gif_url = await blob_storage_service.upload_attachment(content, file_extension, current_user.email, is_video=is_video)
    blob_duration = time.time() - blob_start
    logger.info(f"✅ Blob upload completed in {blob_duration:.2f}s")
    
    file_type = "image" if file.content_type.startswith("image/") else "video"
    attachment = Attachment(
        user_id=current_user.id,
        filename=file.filename,
        blob_url=blob_url,
        placeholder=placeholder,
        file_type=file_type,
        category=category,
        gif_url=gif_url
    )
    
    logger.info("💾 Saving attachment to database...")
    db_start = time.time()
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    db_duration = time.time() - db_start
    logger.info(f"✅ Database save completed in {db_duration:.2f}s")
    
    total_duration = time.time() - start_time
    logger.info(f"🎉 Attachment upload completed successfully!")
    logger.info(f"📈 Total processing time: {total_duration:.2f}s")
    logger.info(f"👤 User: {current_user.email}")
    logger.info(f"🏷️  Placeholder: [{placeholder}]")
    
    return {"message": "Attachment uploaded", "blob_url": blob_url, "id": attachment.id}

@router.get("/attachments", response_model=List[AttachmentOut])
async def list_attachments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    logger = logging.getLogger(__name__)
    
    logger.info(f"📋 Listing attachments for user: {current_user.email}")
    
    try:
        attachments = db.query(Attachment).filter_by(user_id=current_user.id).all()
        logger.info(f"✅ Found {len(attachments)} attachments for user {current_user.email}")
        
        # Log each attachment for debugging
        for att in attachments:
            logger.info(f"   • {att.filename} ({att.placeholder}) - {att.file_type}")
        
        return attachments
        
    except Exception as e:
        logger.error(f"❌ Error listing attachments for user {current_user.email}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list attachments: {str(e)}")

@router.delete("/attachments/{attachment_id}", response_model=Dict[str, str])
async def delete_attachment(attachment_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    attachment = db.query(Attachment).filter_by(id=attachment_id, user_id=current_user.id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    db.delete(attachment)
    db.commit()
    return {"message": "Attachment deleted"}

@router.get("/attachments/resolve/{placeholder}", response_model=Dict[str, str])
async def resolve_placeholder(placeholder: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    attachment = db.query(Attachment).filter_by(user_id=current_user.id, placeholder=placeholder).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Placeholder not found")
    return {"blob_url": attachment.blob_url}

@router.post("/attachments/upload_chunk", response_model=Dict[str, str])
async def upload_chunk(
    chunk: UploadFile = File(...),
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    original_filename: str = Form(...),
    file_extension: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    content = await chunk.read()
    url = await blob_storage_service.upload_chunk(content, upload_id, chunk_index, file_extension, current_user.email)
    return {"message": "Chunk uploaded", "url": url}

@router.post("/attachments/assemble", response_model=Dict[str, str])
async def assemble_chunks(
    upload_id: str = Form(...),
    total_chunks: int = Form(...),
    original_filename: str = Form(...),
    file_extension: str = Form(...),
    placeholder: str = Form(...),
    category: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Download and assemble all chunks
    assembled_bytes = await blob_storage_service.assemble_chunks(upload_id, total_chunks, file_extension, current_user.email)
    
    # Determine if this is a video file
    is_video = file_extension.lower() in [".mp4", ".mov", ".avi", ".wmv", ".mkv", ".webm", ".flv", ".m4v", ".3gp", ".ogv", ".ts", ".mts", ".m2ts"]
    
    # Upload the assembled file as a new attachment
    blob_url, gif_url = await blob_storage_service.upload_attachment(assembled_bytes, file_extension, current_user.email, is_video=is_video)
    
    # Save to DB
    file_type = "image" if file_extension.lower() in [".jpg", ".jpeg", ".png", ".gif", ".webp"] else "video"
    attachment = Attachment(
        user_id=current_user.id,
        filename=original_filename,
        blob_url=blob_url,
        placeholder=placeholder,
        file_type=file_type,
        category=category,
        gif_url=gif_url
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    
    # Delete all chunk blobs
    await blob_storage_service.delete_chunks(upload_id, total_chunks, file_extension)
    
    return {"message": "File assembled and uploaded", "blob_url": blob_url, "id": attachment.id}

@router.post("/attachments/{attachment_id}/thumbnail", response_model=Dict[str, str])
async def upload_custom_thumbnail(
    attachment_id: int,
    thumbnail: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a custom thumbnail for a video attachment"""
    logger = logging.getLogger(__name__)
    
    logger.info(f"🎯 Starting custom thumbnail upload for attachment {attachment_id}")
    logger.info(f"📁 Thumbnail file: {thumbnail.filename}")
    logger.info(f"📊 Size: {thumbnail.size} bytes ({thumbnail.size / (1024*1024):.1f} MB)")
    logger.info(f"🎬 Type: {thumbnail.content_type}")
    
    # Validate that the attachment exists and belongs to the user
    attachment = db.query(Attachment).filter_by(id=attachment_id, user_id=current_user.id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Only allow thumbnails for video attachments
    if not attachment.file_type.lower().startswith("video"):
        raise HTTPException(status_code=400, detail="Custom thumbnails can only be added to video attachments")
    
    # Validate file type (must be an image)
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if thumbnail.content_type not in allowed_types:
        logger.warning(f"❌ Invalid thumbnail file type: {thumbnail.content_type}")
        raise HTTPException(status_code=400, detail="Thumbnail must be an image (JPEG, PNG, GIF, WebP)")
    
    # Validate file size (max 5MB for thumbnails)
    max_size = 5 * 1024 * 1024  # 5MB
    if thumbnail.size > max_size:
        logger.warning(f"❌ Thumbnail too large: {thumbnail.size} bytes ({thumbnail.size / (1024*1024):.1f} MB) > {max_size / (1024*1024)} MB")
        raise HTTPException(status_code=400, detail="Thumbnail size must be < 5MB")
    
    try:
        # Read thumbnail content
        content = await thumbnail.read()
        file_extension = os.path.splitext(thumbnail.filename)[1]
        
        # Upload thumbnail to blob storage
        thumbnail_url, _ = await blob_storage_service.upload_attachment(content, file_extension, current_user.email, is_video=False)
        
        # Update attachment with custom thumbnail URL
        attachment.custom_thumbnail_url = thumbnail_url
        db.commit()
        db.refresh(attachment)
        
        logger.info(f"✅ Custom thumbnail uploaded successfully for attachment {attachment_id}")
        logger.info(f"🔗 Thumbnail URL: {thumbnail_url}")
        
        return {
            "message": "Custom thumbnail uploaded successfully",
            "thumbnail_url": thumbnail_url,
            "attachment_id": attachment_id
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to upload custom thumbnail for attachment {attachment_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload thumbnail: {str(e)}")

@router.delete("/attachments/{attachment_id}/thumbnail", response_model=Dict[str, str])
async def delete_custom_thumbnail(
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove custom thumbnail from a video attachment (fallback to auto-generated GIF)"""
    logger = logging.getLogger(__name__)
    
    logger.info(f"🗑️ Removing custom thumbnail for attachment {attachment_id}")
    
    # Validate that the attachment exists and belongs to the user
    attachment = db.query(Attachment).filter_by(id=attachment_id, user_id=current_user.id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    if not attachment.custom_thumbnail_url:
        raise HTTPException(status_code=400, detail="No custom thumbnail to remove")
    
    # Remove custom thumbnail URL (will fallback to gif_url or simple link)
    attachment.custom_thumbnail_url = None
    db.commit()
    
    logger.info(f"✅ Custom thumbnail removed for attachment {attachment_id}")
    
    return {
        "message": "Custom thumbnail removed successfully",
        "attachment_id": attachment_id
    } 
