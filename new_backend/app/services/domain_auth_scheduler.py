import asyncio
import logging
from datetime import datetime, timedelta
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..db.database import get_db
from ..models.domain_auth_models import Domain, DomainAuthCheck
from ..schemas.domain_auth import CheckType
from .domain_auth_service import DomainAuthService

logger = logging.getLogger(__name__)

class DomainAuthScheduler:
    """
    Service for scheduling and running periodic domain authentication checks
    """
    
    def __init__(self):
        self.check_interval_hours = 24  # Check every 24 hours
        self.is_running = False
    
    async def start_scheduler(self):
        """
        Start the domain authentication scheduler
        """
        if self.is_running:
            logger.warning("Domain auth scheduler is already running")
            return
        
        self.is_running = True
        logger.info("Starting domain authentication scheduler")
        
        try:
            while self.is_running:
                await self.run_domain_auth_checks()
                await asyncio.sleep(self.check_interval_hours * 3600)  # Sleep for 24 hours
        except Exception as e:
            logger.error(f"Error in domain auth scheduler: {e}")
            self.is_running = False
    
    def stop_scheduler(self):
        """
        Stop the domain authentication scheduler
        """
        self.is_running = False
        logger.info("Domain authentication scheduler stopped")
    
    async def run_domain_auth_checks(self):
        """
        Run authentication checks for all active domains
        """
        logger.info("Running scheduled domain authentication checks")
        
        try:
            # Get database session
            db = next(get_db())
            
            # Get all active domains that need checking
            domains_to_check = self._get_domains_needing_check(db)
            
            logger.info(f"Found {len(domains_to_check)} domains to check")
            
            for domain in domains_to_check:
                try:
                    await self._check_single_domain(db, domain)
                except Exception as e:
                    logger.error(f"Error checking domain {domain.domain_name}: {e}")
                    continue
            
            db.close()
            logger.info("Completed scheduled domain authentication checks")
            
        except Exception as e:
            logger.error(f"Error in run_domain_auth_checks: {e}")
    
    def _get_domains_needing_check(self, db: Session) -> List[Domain]:
        """
        Get domains that need authentication checking
        """
        now = datetime.utcnow()
        check_threshold = now - timedelta(hours=self.check_interval_hours)
        
        # Get domains that either:
        # 1. Have never been checked
        # 2. Haven't been checked recently
        # 3. Are active
        domains = db.query(Domain).filter(
            and_(
                Domain.is_active == True,
                Domain.id.notin_(
                    db.query(DomainAuthCheck.domain_id).filter(
                        DomainAuthCheck.last_checked > check_threshold
                    ).distinct()
                )
            )
        ).all()
        
        return domains
    
    async def _check_single_domain(self, db: Session, domain: Domain):
        """
        Check authentication for a single domain
        """
        logger.info(f"Checking authentication for domain: {domain.domain_name}")
        
        auth_service = DomainAuthService(db)
        
        # Perform comprehensive check
        auth_result = auth_service.check_domain_auth(domain.domain_name)
        
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
        
        # Log results
        valid_checks = sum(1 for result in auth_result['checks'].values() if result['is_valid'])
        total_checks = len(auth_result['checks'])
        
        logger.info(f"Domain {domain.domain_name}: {valid_checks}/{total_checks} checks passed, "
                   f"{len(auth_result['alerts'])} alerts")
    
    async def check_domain_immediately(self, domain_id: int):
        """
        Check a specific domain immediately (for manual triggers)
        """
        try:
            db = next(get_db())
            
            domain = db.query(Domain).filter(Domain.id == domain_id).first()
            if not domain:
                logger.error(f"Domain {domain_id} not found")
                return
            
            await self._check_single_domain(db, domain)
            db.close()
            
        except Exception as e:
            logger.error(f"Error in immediate domain check for {domain_id}: {e}")
    
    async def check_user_domains(self, user_id: int):
        """
        Check all domains for a specific user
        """
        try:
            db = next(get_db())
            
            user_domains = db.query(Domain).filter(
                and_(
                    Domain.user_id == user_id,
                    Domain.is_active == True
                )
            ).all()
            
            logger.info(f"Checking {len(user_domains)} domains for user {user_id}")
            
            for domain in user_domains:
                try:
                    await self._check_single_domain(db, domain)
                except Exception as e:
                    logger.error(f"Error checking domain {domain.domain_name} for user {user_id}: {e}")
                    continue
            
            db.close()
            
        except Exception as e:
            logger.error(f"Error checking domains for user {user_id}: {e}")

# Global scheduler instance
domain_auth_scheduler = DomainAuthScheduler()

# Background task functions for FastAPI
async def start_domain_auth_scheduler():
    """
    Start the domain authentication scheduler as a background task
    """
    await domain_auth_scheduler.start_scheduler()

async def stop_domain_auth_scheduler():
    """
    Stop the domain authentication scheduler
    """
    domain_auth_scheduler.stop_scheduler()

async def run_domain_auth_check_task():
    """
    Run a single domain authentication check cycle
    """
    await domain_auth_scheduler.run_domain_auth_checks() 