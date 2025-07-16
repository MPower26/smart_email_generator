import dns.resolver
import re
from typing import Optional, Dict, Any

class SpamVerificationService:
    @staticmethod
    def extract_domain(email: str) -> str:
        return email.split('@')[-1].lower()

    @staticmethod
    def check_spf(domain: str) -> Dict[str, Any]:
        explanation = (
            "SPF (Sender Policy Framework) is a DNS record that tells mail servers which IPs are allowed to send emails for your domain. "
            "It helps prevent spammers from sending emails pretending to be you."
        )
        try:
            answers = dns.resolver.resolve(domain, 'TXT')
            for rdata in answers:
                txt = ''.join(rdata.strings if hasattr(rdata, 'strings') else rdata)
                if txt.startswith('v=spf1'):
                    # Check for include, a, mx, or ip4 mechanisms
                    if re.search(r'(include:|a|mx|ip4:)', txt):
                        return {
                            'status': 'pass',
                            'explanation': explanation,
                            'how_to_fix': '',
                            'record': txt
                        }
                    else:
                        return {
                            'status': 'fail',
                            'explanation': explanation,
                            'how_to_fix': 'Your SPF record does not authorize any sending server. Add include, a, mx, or ip4 mechanisms to your SPF record.',
                            'record': txt
                        }
            return {
                'status': 'fail',
                'explanation': explanation,
                'how_to_fix': 'No SPF record found. Add a TXT record starting with v=spf1 to your DNS zone.',
                'record': None
            }
        except Exception as e:
            return {
                'status': 'fail',
                'explanation': explanation,
                'how_to_fix': f'Error checking SPF: {e}',
                'record': None
            }

    @staticmethod
    def check_dkim(domain: str, selector: Optional[str]) -> Dict[str, Any]:
        explanation = (
            "DKIM (DomainKeys Identified Mail) allows your emails to be signed with a cryptographic signature. "
            "The public key is published in your DNS, and receiving servers can verify that your emails are authentic. "
            "A DKIM selector is a string (like 'default' or 'mail') that identifies which DKIM key to use. "
            "You can usually find your selector in your email sending service settings."
        )
        if not selector:
            selector = 'default'
        dkim_domain = f"{selector}._domainkey.{domain}"
        try:
            answers = dns.resolver.resolve(dkim_domain, 'TXT')
            for rdata in answers:
                txt = ''.join(rdata.strings if hasattr(rdata, 'strings') else rdata)
                if 'p=' in txt:
                    return {
                        'status': 'pass',
                        'explanation': explanation,
                        'how_to_fix': '',
                        'selector': selector,
                        'record': txt
                    }
            return {
                'status': 'fail',
                'explanation': explanation,
                'how_to_fix': f'No DKIM public key found for selector "{selector}". Make sure you have published the DKIM TXT record in your DNS.',
                'selector': selector,
                'record': None
            }
        except Exception as e:
            return {
                'status': 'fail',
                'explanation': explanation,
                'how_to_fix': f'Error checking DKIM: {e}',
                'selector': selector,
                'record': None
            }

    @staticmethod
    def check_dmarc(domain: str) -> Dict[str, Any]:
        explanation = (
            "DMARC (Domain-based Message Authentication, Reporting and Conformance) tells mail servers how to handle emails that fail SPF or DKIM checks. "
            "It also lets you get reports about email authentication for your domain."
        )
        dmarc_domain = f"_dmarc.{domain}"
        try:
            answers = dns.resolver.resolve(dmarc_domain, 'TXT')
            for rdata in answers:
                txt = ''.join(rdata.strings if hasattr(rdata, 'strings') else rdata)
                if txt.startswith('v=DMARC1'):
                    # Extract policy
                    match = re.search(r'p=([a-zA-Z]+)', txt)
                    policy = match.group(1) if match else None
                    if policy == 'none':
                        return {
                            'status': 'warning',
                            'explanation': explanation,
                            'how_to_fix': 'Your DMARC policy is set to none. We recommend setting it to quarantine or reject for better protection.',
                            'policy': policy,
                            'record': txt
                        }
                    elif policy in ['quarantine', 'reject']:
                        return {
                            'status': 'pass',
                            'explanation': explanation,
                            'how_to_fix': '',
                            'policy': policy,
                            'record': txt
                        }
                    else:
                        return {
                            'status': 'fail',
                            'explanation': explanation,
                            'how_to_fix': 'Your DMARC policy is invalid or missing. Set p=quarantine or p=reject in your DMARC record.',
                            'policy': policy,
                            'record': txt
                        }
            return {
                'status': 'fail',
                'explanation': explanation,
                'how_to_fix': 'No DMARC record found. Add a TXT record for _dmarc with v=DMARC1 and a policy.',
                'policy': None,
                'record': None
            }
        except Exception as e:
            return {
                'status': 'fail',
                'explanation': explanation,
                'how_to_fix': f'Error checking DMARC: {e}',
                'policy': None,
                'record': None
            }

    @classmethod
    def analyze_email(cls, email: str, dkim_selector: Optional[str] = None) -> Dict[str, Any]:
        domain = cls.extract_domain(email)
        spf = cls.check_spf(domain)
        dkim = cls.check_dkim(domain, dkim_selector)
        dmarc = cls.check_dmarc(domain)
        summary = {
            'domain': domain,
            'checks': {
                'SPF': spf,
                'DKIM': dkim,
                'DMARC': dmarc
            }
        }
        # Add global alerts
        alerts = []
        for name, check in summary['checks'].items():
            if check['status'] == 'fail':
                alerts.append({
                    'level': 'error',
                    'message': f"{name} check failed: {check['how_to_fix']}"
                })
            elif check['status'] == 'warning':
                alerts.append({
                    'level': 'warning',
                    'message': f"{name} warning: {check['how_to_fix']}"
                })
        summary['alerts'] = alerts
        return summary 
