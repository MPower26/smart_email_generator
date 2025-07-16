import dns.resolver
import re
import socket
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
                txt = ''.join(
                    s.decode('utf-8') if isinstance(s, bytes) else str(s)
                    for s in (rdata.strings if hasattr(rdata, 'strings') else rdata)
                )
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
                txt = ''.join(
                    s.decode('utf-8') if isinstance(s, bytes) else str(s)
                    for s in (rdata.strings if hasattr(rdata, 'strings') else rdata)
                )
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
            # Custom message for DNS query name does not exist
            err_msg = str(e)
            if 'The DNS query name does not exist' in err_msg or 'NXDOMAIN' in err_msg:
                how_to_fix = (
                    f"No DKIM record found for selector '{selector}'.\n"
                    "How to set up DKIM for your domain:\n"
                    "1. Log in to your email provider's admin console (e.g., Google Workspace Admin, Microsoft 365, SendGrid, etc.).\n"
                    "2. Find the DKIM or domain authentication section.\n"
                    "3. Locate or generate your DKIM selector (it may be a random string, not 'default').\n"
                    "4. Copy the DNS TXT record details provided by your provider.\n"
                    "5. Go to your domain registrar's DNS management page.\n"
                    f"6. Add a TXT record with name: '{{selector}}._domainkey.{domain}' and the value provided.\n"
                    "7. Save and publish your DNS changes.\n"
                    "8. Wait for DNS propagation, then verify DKIM in your provider's admin panel.\n"
                    "\nFor Google Workspace: https://support.google.com/a/answer/180504?hl=en\n"
                    "For Microsoft 365: https://learn.microsoft.com/en-us/microsoft-365/security/office-365-security/use-dkim-to-validate-outbound-email\n"
                    "For SendGrid: https://docs.sendgrid.com/ui/account-and-settings/how-to-set-up-domain-authentication\n"
                )
            else:
                how_to_fix = f'Error checking DKIM: {e}'
            return {
                'status': 'fail',
                'explanation': explanation,
                'how_to_fix': how_to_fix,
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
                txt = ''.join(
                    s.decode('utf-8') if isinstance(s, bytes) else str(s)
                    for s in (rdata.strings if hasattr(rdata, 'strings') else rdata)
                )
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

    @staticmethod
    def check_blacklists(domain: str) -> Dict[str, Any]:
        explanation = (
            "Blacklist (RBL) checks determine if your sending IP is listed on public spam blacklists. "
            "If your IP is blacklisted, your emails are likely to be rejected or marked as spam."
        )
        rbls = [
            'zen.spamhaus.org',
            'bl.spamcop.net',
            'b.barracudacentral.org',
            'dnsbl.sorbs.net',
            'psbl.surriel.com',
            'spam.abuse.ch',
            'cbl.abuseat.org',
            'dnsbl-1.uceprotect.net',
        ]
        try:
            # Get the IP address of the domain
            ip = socket.gethostbyname(domain)
            reversed_ip = '.'.join(reversed(ip.split('.')))
            blacklisted = []
            for rbl in rbls:
                query = f"{reversed_ip}.{rbl}"
                try:
                    dns.resolver.resolve(query, 'A')
                    blacklisted.append(rbl)
                except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.Timeout):
                    continue
            if blacklisted:
                return {
                    'status': 'fail',
                    'explanation': explanation,
                    'how_to_fix': 'Your sending IP is listed on one or more public blacklists. You should request delisting from the RBLs shown below, or contact your hosting provider.',
                    'blacklisted_on': blacklisted,
                    'ip': ip
                }
            else:
                return {
                    'status': 'pass',
                    'explanation': explanation,
                    'how_to_fix': '',
                    'blacklisted_on': [],
                    'ip': ip
                }
        except Exception as e:
            return {
                'status': 'fail',
                'explanation': explanation,
                'how_to_fix': f'Error checking blacklists: {e}',
                'blacklisted_on': None,
                'ip': None
            }

    @classmethod
    def analyze_email(cls, email: str, dkim_selector: Optional[str] = None) -> Dict[str, Any]:
        domain = cls.extract_domain(email)
        spf = cls.check_spf(domain)
        dkim = cls.check_dkim(domain, dkim_selector)
        dmarc = cls.check_dmarc(domain)
        blacklist = cls.check_blacklists(domain)
        summary = {
            'domain': domain,
            'checks': {
                'SPF': spf,
                'DKIM': dkim,
                'DMARC': dmarc,
                'BLACKLIST': blacklist
            }
        }
        # Add global alerts
        alerts = []
        for name, check in summary['checks'].items():
            if check['status'] == 'fail':
                if name == 'BLACKLIST' and check.get('blacklisted_on'):
                    alerts.append({
                        'level': 'error',
                        'message': f"Your sending IP ({check.get('ip')}) is blacklisted on: {', '.join(check['blacklisted_on'])}. Request delisting or contact your provider."
                    })
                else:
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