import dns.resolver
import dns.exception
import re
import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend
import base64

from ..models.domain_auth_models import Domain, DomainAuthCheck, DomainAlert
from ..schemas.domain_auth import CheckType, AlertType, AlertLevel, DKIMKeyPair

logger = logging.getLogger(__name__)

class DomainAuthService:
    def __init__(self, db: Session):
        self.db = db

    def check_spf(self, domain: str) -> Dict[str, Any]:
        """
        Check SPF record for a domain
        """
        try:
            # Look for TXT records
            txt_records = dns.resolver.resolve(domain, 'TXT')
            
            spf_record = None
            for record in txt_records:
                record_str = str(record).strip('"')
                if record_str.startswith('v=spf1'):
                    spf_record = record_str
                    break
            
            if not spf_record:
                return {
                    'record_found': False,
                    'is_valid': False,
                    'check_data': {
                        'error': 'No SPF record found',
                        'recommendation': f'Add SPF record: v=spf1 include:_spf.yourdomain.com ~all'
                    }
                }
            
            # Basic SPF validation
            is_valid = self._validate_spf_record(spf_record)
            
            return {
                'record_found': True,
                'is_valid': is_valid,
                'check_data': {
                    'spf_record': spf_record,
                    'validation_details': self._analyze_spf_record(spf_record)
                }
            }
            
        except dns.exception.DNSException as e:
            logger.error(f"DNS error checking SPF for {domain}: {e}")
            return {
                'record_found': False,
                'is_valid': False,
                'check_data': {
                    'error': f'DNS resolution failed: {str(e)}'
                }
            }
        except Exception as e:
            logger.error(f"Error checking SPF for {domain}: {e}")
            return {
                'record_found': False,
                'is_valid': False,
                'check_data': {
                    'error': f'Unexpected error: {str(e)}'
                }
            }

    def check_dkim(self, domain: str, selector: str = "default") -> Dict[str, Any]:
        """
        Check DKIM record for a domain
        """
        try:
            dkim_domain = f"{selector}._domainkey.{domain}"
            txt_records = dns.resolver.resolve(dkim_domain, 'TXT')
            
            dkim_record = None
            for record in txt_records:
                record_str = str(record).strip('"')
                if 'v=DKIM1' in record_str and 'p=' in record_str:
                    dkim_record = record_str
                    break
            
            if not dkim_record:
                return {
                    'record_found': False,
                    'is_valid': False,
                    'check_data': {
                        'error': f'No DKIM record found for selector {selector}',
                        'recommendation': f'Add DKIM record for {dkim_domain}'
                    }
                }
            
            # Validate DKIM record format
            is_valid = self._validate_dkim_record(dkim_record)
            
            return {
                'record_found': True,
                'is_valid': is_valid,
                'check_data': {
                    'dkim_record': dkim_record,
                    'selector': selector,
                    'dkim_domain': dkim_domain,
                    'validation_details': self._analyze_dkim_record(dkim_record)
                }
            }
            
        except dns.resolver.NXDOMAIN:
            # Domain doesn't exist - this is expected for many DKIM selectors
            return {
                'record_found': False,
                'is_valid': False,
                'check_data': {
                    'error': f'No DKIM record found for selector {selector}',
                    'recommendation': f'Add DKIM record for {dkim_domain}'
                }
            }
        except dns.exception.DNSException as e:
            # Only log as error if it's not a "domain not found" type error
            if "does not exist" not in str(e) and "NXDOMAIN" not in str(e):
                logger.error(f"DNS error checking DKIM for {domain}: {e}")
            return {
                'record_found': False,
                'is_valid': False,
                'check_data': {
                    'error': f'DNS resolution failed: {str(e)}'
                }
            }
        except Exception as e:
            logger.error(f"Error checking DKIM for {domain}: {e}")
            return {
                'record_found': False,
                'is_valid': False,
                'check_data': {
                    'error': f'Unexpected error: {str(e)}'
                }
            }

    def check_dmarc(self, domain: str) -> Dict[str, Any]:
        """
        Check DMARC record for a domain
        """
        try:
            dmarc_domain = f"_dmarc.{domain}"
            txt_records = dns.resolver.resolve(dmarc_domain, 'TXT')
            
            dmarc_record = None
            for record in txt_records:
                record_str = str(record).strip('"')
                if record_str.startswith('v=DMARC1'):
                    dmarc_record = record_str
                    break
            
            if not dmarc_record:
                return {
                    'record_found': False,
                    'is_valid': False,
                    'check_data': {
                        'error': 'No DMARC record found',
                        'recommendation': f'Add DMARC record: v=DMARC1; p=quarantine; rua=mailto:dmarc@{domain}'
                    }
                }
            
            # Validate DMARC record
            is_valid, policy = self._validate_dmarc_record(dmarc_record)
            
            return {
                'record_found': True,
                'is_valid': is_valid,
                'check_data': {
                    'dmarc_record': dmarc_record,
                    'policy': policy,
                    'validation_details': self._analyze_dmarc_record(dmarc_record)
                }
            }
            
        except dns.exception.DNSException as e:
            logger.error(f"DNS error checking DMARC for {domain}: {e}")
            return {
                'record_found': False,
                'is_valid': False,
                'check_data': {
                    'error': f'DNS resolution failed: {str(e)}'
                }
            }
        except Exception as e:
            logger.error(f"Error checking DMARC for {domain}: {e}")
            return {
                'record_found': False,
                'is_valid': False,
                'check_data': {
                    'error': f'Unexpected error: {str(e)}'
                }
            }

    def _validate_spf_record(self, spf_record: str) -> bool:
        """
        Basic SPF record validation
        """
        if not spf_record.startswith('v=spf1'):
            return False
        
        # Check for basic SPF mechanisms
        mechanisms = spf_record.split()
        if len(mechanisms) < 2:  # Must have at least v=spf1 and one mechanism
            return False
        
        return True

    def _analyze_spf_record(self, spf_record: str) -> Dict[str, Any]:
        """
        Analyze SPF record and provide recommendations
        """
        mechanisms = spf_record.split()
        analysis = {
            'mechanisms': [],
            'recommendations': []
        }
        
        for mechanism in mechanisms[1:]:  # Skip v=spf1
            if mechanism.startswith('include:'):
                analysis['mechanisms'].append(f"Include: {mechanism.split(':')[1]}")
            elif mechanism.startswith('ip4:'):
                analysis['mechanisms'].append(f"IP4: {mechanism.split(':')[1]}")
            elif mechanism.startswith('ip6:'):
                analysis['mechanisms'].append(f"IP6: {mechanism.split(':')[1]}")
            elif mechanism in ['a', 'mx', 'exists']:
                analysis['mechanisms'].append(f"Mechanism: {mechanism}")
            elif mechanism in ['~all', '-all', '+all']:
                analysis['mechanisms'].append(f"Default: {mechanism}")
        
        # Check for common issues
        if '~all' in spf_record:
            analysis['recommendations'].append("Consider using '-all' instead of '~all' for stricter policy")
        
        if not any(mech in spf_record for mech in ['~all', '-all', '+all']):
            analysis['recommendations'].append("Add default mechanism (e.g., ~all)")
        
        return analysis

    def _validate_dkim_record(self, dkim_record: str) -> bool:
        """
        Basic DKIM record validation
        """
        required_fields = ['v=DKIM1', 'p=']
        return all(field in dkim_record for field in required_fields)

    def _analyze_dkim_record(self, dkim_record: str) -> Dict[str, Any]:
        """
        Analyze DKIM record and provide recommendations
        """
        analysis = {
            'fields': {},
            'recommendations': []
        }
        
        # Parse DKIM fields
        fields = dkim_record.split(';')
        for field in fields:
            field = field.strip()
            if '=' in field:
                key, value = field.split('=', 1)
                analysis['fields'][key.strip()] = value.strip()
        
        # Check for common issues
        if 'k=rsa' not in dkim_record:
            analysis['recommendations'].append("Consider specifying key type: k=rsa")
        
        if 's=email' not in dkim_record:
            analysis['recommendations'].append("Consider specifying service type: s=email")
        
        return analysis

    def _validate_dmarc_record(self, dmarc_record: str) -> Tuple[bool, str]:
        """
        Validate DMARC record and extract policy
        """
        if not dmarc_record.startswith('v=DMARC1'):
            return False, "none"
        
        # Extract policy
        policy_match = re.search(r'p=(\w+)', dmarc_record)
        if not policy_match:
            return False, "none"
        
        policy = policy_match.group(1)
        return True, policy

    def _analyze_dmarc_record(self, dmarc_record: str) -> Dict[str, Any]:
        """
        Analyze DMARC record and provide recommendations
        """
        analysis = {
            'fields': {},
            'recommendations': []
        }
        
        # Parse DMARC fields
        fields = dmarc_record.split(';')
        for field in fields:
            field = field.strip()
            if '=' in field:
                key, value = field.split('=', 1)
                analysis['fields'][key.strip()] = value.strip()
        
        # Check policy
        policy = analysis['fields'].get('p', 'none')
        if policy == 'none':
            analysis['recommendations'].append("Consider upgrading policy to 'quarantine' or 'reject'")
        elif policy == 'quarantine':
            analysis['recommendations'].append("Consider upgrading policy to 'reject' for maximum security")
        
        # Check for reporting
        if 'rua=' not in dmarc_record:
            analysis['recommendations'].append("Add reporting address: rua=mailto:dmarc@yourdomain.com")
        
        return analysis

    def generate_dkim_keys(self, domain: str, selector: str = "default") -> DKIMKeyPair:
        """
        Generate DKIM key pair for a domain
        """
        # Generate RSA key pair
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        
        public_key = private_key.public_key()
        
        # Serialize keys
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ).decode('utf-8')
        
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode('utf-8')
        
        # Extract public key for DNS record (remove headers and newlines)
        public_key_clean = ''.join(public_pem.split('\n')[1:-2])
        
        # Create DNS record
        dns_record = f'v=DKIM1; k=rsa; p={public_key_clean}'
        
        return DKIMKeyPair(
            selector=selector,
            private_key=private_pem,
            public_key=public_pem,
            dns_record=dns_record
        )

    def check_domain_auth(self, domain: str, check_types: Optional[List[CheckType]] = None) -> Dict[str, Any]:
        """
        Perform comprehensive domain authentication check
        """
        if check_types is None:
            check_types = [CheckType.SPF, CheckType.DKIM, CheckType.DMARC]
        
        results = {
            'domain': domain,
            'checks': {},
            'alerts': [],
            'overall_status': 'valid'
        }
        
        # Perform checks
        if CheckType.SPF in check_types:
            spf_result = self.check_spf(domain)
            results['checks']['SPF'] = spf_result
            if not spf_result['is_valid']:
                results['alerts'].append({
                    'type': AlertType.SPF_MISSING if not spf_result['record_found'] else AlertType.SPF_INVALID,
                    'level': AlertLevel.ERROR,
                    'message': spf_result['check_data'].get('error', 'SPF validation failed')
                })
        
        if CheckType.DKIM in check_types:
            # Try common DKIM selectors
            common_selectors = ["default", "google", "selector1", "selector2", "k1", "k2"]
            dkim_result = None
            
            for selector in common_selectors:
                dkim_result = self.check_dkim(domain, selector)
                if dkim_result['record_found']:
                    break
            
            # If no DKIM record found with any selector, use the last result
            if not dkim_result:
                dkim_result = self.check_dkim(domain, "default")
            
            results['checks']['DKIM'] = dkim_result
            if not dkim_result['is_valid']:
                results['alerts'].append({
                    'type': AlertType.DKIM_MISSING if not dkim_result['record_found'] else AlertType.DKIM_INVALID,
                    'level': AlertLevel.ERROR,
                    'message': dkim_result['check_data'].get('error', 'DKIM validation failed')
                })
        
        if CheckType.DMARC in check_types:
            dmarc_result = self.check_dmarc(domain)
            results['checks']['DMARC'] = dmarc_result
            if not dmarc_result['is_valid']:
                results['alerts'].append({
                    'type': AlertType.DMARC_MISSING,
                    'level': AlertLevel.ERROR,
                    'message': dmarc_result['check_data'].get('error', 'DMARC validation failed')
                })
            elif dmarc_result['check_data'].get('policy') == 'none':
                results['alerts'].append({
                    'type': AlertType.DMARC_PERMISSIVE,
                    'level': AlertLevel.WARNING,
                    'message': 'DMARC policy is set to "none". Consider upgrading to "quarantine" or "reject"'
                })
        
        # Determine overall status
        if any(alert['level'] == AlertLevel.ERROR for alert in results['alerts']):
            results['overall_status'] = 'error'
        elif any(alert['level'] == AlertLevel.WARNING for alert in results['alerts']):
            results['overall_status'] = 'warning'
        
        return results

    def save_domain_auth_check(self, domain_id: int, check_type: CheckType, result: Dict[str, Any]):
        """
        Save domain authentication check result to database
        """
        # Update or create auth check record
        auth_check = self.db.query(DomainAuthCheck).filter(
            DomainAuthCheck.domain_id == domain_id,
            DomainAuthCheck.check_type == check_type.value
        ).first()
        
        if auth_check:
            auth_check.record_found = result['record_found']
            auth_check.is_valid = result['is_valid']
            auth_check.last_checked = datetime.utcnow()
            auth_check.check_data = result.get('check_data', {})
        else:
            auth_check = DomainAuthCheck(
                domain_id=domain_id,
                check_type=check_type.value,
                record_found=result['record_found'],
                is_valid=result['is_valid'],
                last_checked=datetime.utcnow(),
                check_data=result.get('check_data', {})
            )
            self.db.add(auth_check)
        
        self.db.commit()
        return auth_check

    def create_domain_alert(self, domain_id: int, alert_type: AlertType, level: AlertLevel, message: str):
        """
        Create domain alert in database
        """
        alert = DomainAlert(
            domain_id=domain_id,
            alert_type=alert_type.value,
            level=level.value,
            message=message,
            is_resolved=False
        )
        self.db.add(alert)
        self.db.commit()
        return alert

    def resolve_domain_alert(self, alert_id: int):
        """
        Mark domain alert as resolved
        """
        alert = self.db.query(DomainAlert).filter(DomainAlert.id == alert_id).first()
        if alert:
            alert.is_resolved = True
            alert.resolved_at = datetime.utcnow()
            self.db.commit()
        return alert 
