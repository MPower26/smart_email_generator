from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from ...db.database import get_db
from ...middleware.auth import get_current_user
from ...models.models import User
from ...models.domain_auth_models import Domain, DomainAuthCheck, DomainAlert
from ...schemas.domain_auth import (
    DomainCreate, DomainUpdate, DomainResponse, DomainAuthCheckRequest,
    DomainAuthCheckResponse, DKIMKeyPair, DomainConfiguration, CheckType
)
from ...services.domain_auth_service import DomainAuthService

router = APIRouter()

@router.post("/domains", response_model=DomainResponse)
async def create_domain(
    domain_data: DomainCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new domain for the current user
    """
    # Check if domain already exists for this user
    existing_domain = db.query(Domain).filter(
        Domain.user_id == current_user.id,
        Domain.domain_name == domain_data.domain_name
    ).first()
    
    if existing_domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Domain already exists for this user"
        )
    
    # If this is the first domain or marked as primary, set it as primary
    if domain_data.is_primary or not db.query(Domain).filter(Domain.user_id == current_user.id).first():
        domain_data.is_primary = True
        # Unset other primary domains
        db.query(Domain).filter(Domain.user_id == current_user.id).update({"is_primary": False})
    
    # Create domain
    domain = Domain(
        user_id=current_user.id,
        domain_name=domain_data.domain_name,
        is_primary=domain_data.is_primary,
        is_active=domain_data.is_active
    )
    
    db.add(domain)
    db.commit()
    db.refresh(domain)
    
    # Perform initial authentication check
    auth_service = DomainAuthService(db)
    auth_result = auth_service.check_domain_auth(domain.domain_name)
    
    # Save check results
    for check_type, result in auth_result['checks'].items():
        auth_service.save_domain_auth_check(domain.id, CheckType(check_type), result)
    
    # Create alerts if any
    for alert in auth_result['alerts']:
        auth_service.create_domain_alert(
            domain.id,
            alert['type'],
            alert['level'],
            alert['message']
        )
    
    return domain

@router.get("/domains", response_model=List[DomainResponse])
async def get_user_domains(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all domains for the current user
    """
    domains = db.query(Domain).filter(Domain.user_id == current_user.id).all()
    return domains

@router.get("/domains/{domain_id}", response_model=DomainResponse)
async def get_domain(
    domain_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific domain by ID
    """
    domain = db.query(Domain).filter(
        Domain.id == domain_id,
        Domain.user_id == current_user.id
    ).first()
    
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )
    
    return domain

@router.put("/domains/{domain_id}", response_model=DomainResponse)
async def update_domain(
    domain_id: int,
    domain_data: DomainUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a domain
    """
    domain = db.query(Domain).filter(
        Domain.id == domain_id,
        Domain.user_id == current_user.id
    ).first()
    
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )
    
    # Update fields
    update_data = domain_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(domain, field, value)
    
    # Handle primary domain logic
    if domain_data.is_primary:
        # Unset other primary domains
        db.query(Domain).filter(
            Domain.user_id == current_user.id,
            Domain.id != domain_id
        ).update({"is_primary": False})
    
    domain.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(domain)
    
    return domain

@router.delete("/domains/{domain_id}")
async def delete_domain(
    domain_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a domain
    """
    domain = db.query(Domain).filter(
        Domain.id == domain_id,
        Domain.user_id == current_user.id
    ).first()
    
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )
    
    db.delete(domain)
    db.commit()
    
    return {"message": "Domain deleted successfully"}

@router.post("/domains/{domain_id}/check-auth", response_model=DomainAuthCheckResponse)
async def check_domain_auth(
    domain_id: int,
    check_request: DomainAuthCheckRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check domain authentication (SPF, DKIM, DMARC)
    """
    domain = db.query(Domain).filter(
        Domain.id == domain_id,
        Domain.user_id == current_user.id
    ).first()
    
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )
    
    auth_service = DomainAuthService(db)
    auth_result = auth_service.check_domain_auth(
        domain.domain_name,
        check_request.check_types
    )
    
    # Save check results
    for check_type, result in auth_result['checks'].items():
        auth_service.save_domain_auth_check(domain.id, CheckType(check_type), result)
    
    # Create or update alerts
    for alert in auth_result['alerts']:
        auth_service.create_domain_alert(
            domain.id,
            alert['type'],
            alert['level'],
            alert['message']
        )
    
    return {
        "domain": domain.domain_name,
        "checks": [
            {
                "check_type": CheckType(check_type),
                "record_found": result['record_found'],
                "is_valid": result['is_valid'],
                "last_checked": datetime.utcnow(),
                "check_data": result.get('check_data', {})
            }
            for check_type, result in auth_result['checks'].items()
        ],
        "alerts": auth_result['alerts'],
        "summary": {
            "overall_status": auth_result['overall_status'],
            "total_checks": len(auth_result['checks']),
            "valid_checks": sum(1 for result in auth_result['checks'].values() if result['is_valid']),
            "total_alerts": len(auth_result['alerts'])
        }
    }

@router.post("/domains/{domain_id}/generate-dkim", response_model=DKIMKeyPair)
async def generate_dkim_keys(
    domain_id: int,
    selector: str = "default",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate DKIM key pair for a domain
    """
    domain = db.query(Domain).filter(
        Domain.id == domain_id,
        Domain.user_id == current_user.id
    ).first()
    
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )
    
    auth_service = DomainAuthService(db)
    dkim_keys = auth_service.generate_dkim_keys(domain.domain_name, selector)
    
    # Update domain with DKIM selector
    domain.dkim_selector = selector
    domain.dkim_private_key = dkim_keys.private_key
    domain.dkim_public_key = dkim_keys.public_key
    domain.updated_at = datetime.utcnow()
    
    db.commit()
    
    return dkim_keys

@router.get("/domains/{domain_id}/configuration", response_model=DomainConfiguration)
async def get_domain_configuration(
    domain_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get domain configuration with DNS records and recommendations
    """
    domain = db.query(Domain).filter(
        Domain.id == domain_id,
        Domain.user_id == current_user.id
    ).first()
    
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )
    
    auth_service = DomainAuthService(db)
    auth_result = auth_service.check_domain_auth(domain.domain_name)
    
    configuration = {
        "domain_name": domain.domain_name,
        "spf_record": None,
        "dkim_record": None,
        "dmarc_record": None,
        "recommendations": []
    }
    
    # Extract DNS records
    if 'SPF' in auth_result['checks']:
        spf_data = auth_result['checks']['SPF']['check_data']
        configuration['spf_record'] = spf_data.get('spf_record')
        if not auth_result['checks']['SPF']['is_valid']:
            configuration['recommendations'].append(spf_data.get('recommendation', 'Configure SPF record'))
    
    if 'DKIM' in auth_result['checks']:
        dkim_data = auth_result['checks']['DKIM']['check_data']
        configuration['dkim_record'] = dkim_data.get('dkim_record')
        if not auth_result['checks']['DKIM']['is_valid']:
            configuration['recommendations'].append(dkim_data.get('recommendation', 'Configure DKIM record'))
    
    if 'DMARC' in auth_result['checks']:
        dmarc_data = auth_result['checks']['DMARC']['check_data']
        configuration['dmarc_record'] = dmarc_data.get('dmarc_record')
        if not auth_result['checks']['DMARC']['is_valid']:
            configuration['recommendations'].append(dmarc_data.get('recommendation', 'Configure DMARC record'))
    
    # Add recommendations from alerts
    for alert in auth_result['alerts']:
        if alert['level'] in ['warning', 'error']:
            configuration['recommendations'].append(alert['message'])
    
    return configuration

@router.post("/domains/{domain_id}/alerts/{alert_id}/resolve")
async def resolve_domain_alert(
    domain_id: int,
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark a domain alert as resolved
    """
    # Verify domain ownership
    domain = db.query(Domain).filter(
        Domain.id == domain_id,
        Domain.user_id == current_user.id
    ).first()
    
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )
    
    auth_service = DomainAuthService(db)
    alert = auth_service.resolve_domain_alert(alert_id)
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )
    
    return {"message": "Alert resolved successfully"}

@router.get("/domains/{domain_id}/alerts")
async def get_domain_alerts(
    domain_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all alerts for a domain
    """
    domain = db.query(Domain).filter(
        Domain.id == domain_id,
        Domain.user_id == current_user.id
    ).first()
    
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )
    
    alerts = db.query(DomainAlert).filter(DomainAlert.domain_id == domain_id).all()
    return alerts

@router.post("/domains/{domain_id}/check-now")
async def check_domain_now(
    domain_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Trigger immediate authentication check for a domain
    """
    domain = db.query(Domain).filter(
        Domain.id == domain_id,
        Domain.user_id == current_user.id
    ).first()
    
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )
    
    # Import here to avoid circular imports
    from ...services.domain_auth_scheduler import domain_auth_scheduler
    
    # Trigger immediate check
    await domain_auth_scheduler.check_domain_immediately(domain_id)
    
    return {"message": f"Authentication check triggered for domain {domain.domain_name}"}

@router.post("/domains/check-all")
async def check_all_user_domains(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Trigger authentication check for all domains of the current user
    """
    # Import here to avoid circular imports
    from ...services.domain_auth_scheduler import domain_auth_scheduler
    
    # Trigger check for all user domains
    await domain_auth_scheduler.check_user_domains(current_user.id)
    
    return {"message": "Authentication check triggered for all user domains"} 