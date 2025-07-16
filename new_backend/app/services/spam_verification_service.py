import dns.resolver
import re
import socket
from typing import Optional, Dict, Any
import datetime
# Fix whois import for domain age
try:
    from whois import whois
except ImportError:
    whois = None

FREE_EMAIL_DOMAINS = set([
    'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'aol.com', 'icloud.com', 'mail.com', 'gmx.com', 'protonmail.com', 'zoho.com', 'yandex.com', 'msn.com', 'live.com', 'comcast.net', 'me.com', 'mac.com', 'rocketmail.com', 'mail.ru', 'qq.com', 'naver.com', '163.com', '126.com', 'sina.com', 'rediffmail.com', 'web.de', 'cox.net', 'bellsouth.net', 'earthlink.net', 'charter.net', 'shaw.ca', 'blueyonder.co.uk', 'btinternet.com', 'virginmedia.com', 'ntlworld.com', 'talktalk.net', 'sky.com', 'optonline.net', 'orange.fr', 'wanadoo.fr', 'free.fr', 'laposte.net', 'sfr.fr', 'neuf.fr', 'aliceadsl.fr', 't-online.de', 'arcor.de', 'libero.it', 'virgilio.it', 'tin.it', 'tiscali.it', 'alice.it', 'live.it', 'email.it', 'fastwebnet.it', 'inwind.it', 'iol.it', 'tele2.it', 'poste.it', 'vodafone.it', 'mail.bg', 'abv.bg', 'dir.bg', 'mail.ee', 'mail.kz', 'bk.ru', 'list.ru', 'inbox.ru', 'mail.ua', 'ukr.net', 'rambler.ru',
])

# Update blacklist lists
IP_BLACKLISTS = [
    'zen.spamhaus.org',
    'b.barracudacentral.org',
    'bl.spamcop.net',
    'cbl.abuseat.org',
    'dnsbl.invaluement.com',
    'psbl.surriel.com',
    'dnsbl-1.uceprotect.net',
    'dnsbl.spfbl.net',
    'rbl.realtimeblacklist.com',
    'dnsbl.dronebl.org',
]
DOMAIN_BLACKLISTS = [
    'dbl.spamhaus.org',
    'multi.surbl.org',
]

RBL_DELIST_LINKS = {
    'zen.spamhaus.org': 'https://www.spamhaus.org/lookup/',
    'dbl.spamhaus.org': 'https://www.spamhaus.org/lookup/',
    'bl.spamcop.net': 'https://www.spamcop.net/bl.shtml',
    'b.barracudacentral.org': 'https://www.barracudacentral.org/lookups',
    'cbl.abuseat.org': 'https://www.abuseat.org/lookup.cgi',
    'dnsbl.invaluement.com': 'https://www.invaluement.com/lookup/',
    'psbl.surriel.com': 'https://psbl.org/',
    'dnsbl-1.uceprotect.net': 'https://www.uceprotect.net/en/rblcheck.php',
    'dnsbl.spfbl.net': 'https://spfbl.net/en/check/',
    'rbl.realtimeblacklist.com': 'https://www.realtimeblacklist.com/',
    'dnsbl.dronebl.org': 'https://dronebl.org/lookup',
    'multi.surbl.org': 'https://www.surbl.org/',
}

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
    def check_blacklists(domain: str, sending_ip: str = None) -> Dict[str, Any]:
        explanation = (
            "Blacklist (RBL) checks determine if your sending IP or domain is listed on public spam blacklists. "
            "If your IP is blacklisted, your emails are likely to be rejected or marked as spam. "
            "This tool checks both your domain name (in domain-based blacklists) and, if provided, your sending IP (in IP-based blacklists). "
            "For the most accurate results, check your actual sending IP address (the IP shown in your email headers). "
            "If you know your sending IP, you can provide it for a more accurate check."
        )
        ip_blacklisted = []
        domain_blacklisted = []
        checked_ip = sending_ip
        checked_domain = domain
        # IP-based blacklists
        if sending_ip:
            reversed_ip = '.'.join(reversed(sending_ip.split('.')))
            for rbl in IP_BLACKLISTS:
                query = f"{reversed_ip}.{rbl}"
                try:
                    dns.resolver.resolve(query, 'A')
                    ip_blacklisted.append(rbl)
                except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.Timeout):
                    continue
        # Domain-based blacklists
        for rbl in DOMAIN_BLACKLISTS:
            query = f"{domain}.{rbl}"
            try:
                dns.resolver.resolve(query, 'A')
                domain_blacklisted.append(rbl)
            except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.Timeout):
                continue
        # Compose result
        if ip_blacklisted or domain_blacklisted:
            return {
                'status': 'fail',
                'explanation': explanation,
                'how_to_fix': 'Your domain or sending IP is listed on one or more public blacklists. You should request delisting from the RBLs shown below, or contact your provider.',
                'ip_blacklisted_on': ip_blacklisted,
                'domain_blacklisted_on': domain_blacklisted,
                'checked_ip': checked_ip,
                'checked_domain': checked_domain
            }
        else:
            return {
                'status': 'pass',
                'explanation': explanation,
                'how_to_fix': '',
                'ip_blacklisted_on': [],
                'domain_blacklisted_on': [],
                'checked_ip': checked_ip,
                'checked_domain': checked_domain
            }

    @staticmethod
    def check_ptr(ip: str, domain: str) -> Dict[str, Any]:
        explanation = (
            "PTR (reverse DNS) records map an IP address back to a domain name. "
            "Many spam filters require that your sending IP has a PTR record matching your domain."
        )
        try:
            ptr = socket.gethostbyaddr(ip)[0].rstrip('.')
            if domain in ptr:
                return {
                    'status': 'pass',
                    'explanation': explanation,
                    'how_to_fix': '',
                    'ptr': ptr
                }
            else:
                return {
                    'status': 'fail',
                    'explanation': explanation,
                    'how_to_fix': f"Your sending IP's PTR record is '{ptr}', which does not match your domain. Ask your hosting provider to set the PTR to your domain.",
                    'ptr': ptr
                }
        except Exception as e:
            return {
                'status': 'fail',
                'explanation': explanation,
                'how_to_fix': f"No PTR record found for your sending IP. Ask your hosting provider to set a PTR (reverse DNS) record to your domain. Error: {e}",
                'ptr': None
            }

    @staticmethod
    def check_mx(domain: str) -> Dict[str, Any]:
        explanation = (
            "MX (Mail Exchange) records specify the mail servers responsible for receiving email for your domain. "
            "Having valid MX records is important for deliverability and reputation."
        )
        try:
            answers = dns.resolver.resolve(domain, 'MX')
            mx_records = [str(r.exchange).rstrip('.') for r in answers]
            if mx_records:
                return {
                    'status': 'pass',
                    'explanation': explanation,
                    'how_to_fix': '',
                    'mx_records': mx_records
                }
            else:
                return {
                    'status': 'fail',
                    'explanation': explanation,
                    'how_to_fix': 'No MX records found. Add MX records in your DNS to receive email and improve reputation.',
                    'mx_records': []
                }
        except Exception as e:
            return {
                'status': 'fail',
                'explanation': explanation,
                'how_to_fix': f'Error checking MX records: {e}. Add MX records in your DNS to receive email and improve reputation.',
                'mx_records': []
            }

    @staticmethod
    def check_domain_age(domain: str) -> Dict[str, Any]:
        explanation = (
            "Domain age is a factor in email reputation. New domains are more likely to be flagged as spam. "
            "Older domains are generally more trusted."
        )
        if not whois:
            return {
                'status': 'warning',
                'explanation': explanation,
                'how_to_fix': 'Domain age check is unavailable (whois module not installed or import failed).',
                'age_days': None,
                'created': None
            }
        try:
            w = whois(domain)
            created = w.creation_date
            if isinstance(created, list):
                created = created[0]
            if not created:
                return {
                    'status': 'warning',
                    'explanation': explanation,
                    'how_to_fix': 'Could not determine domain creation date from WHOIS.',
                    'age_days': None,
                    'created': None
                }
            # Ensure both datetimes are timezone-aware (UTC)
            now = datetime.datetime.now(datetime.timezone.utc)
            if created.tzinfo is None or created.tzinfo.utcoffset(created) is None:
                created = created.replace(tzinfo=datetime.timezone.utc)
            age_days = (now - created).days
            return {
                'status': 'pass',
                'explanation': explanation,
                'how_to_fix': '',
                'age_days': age_days,
                'created': created.isoformat() if hasattr(created, 'isoformat') else str(created)
            }
        except Exception as e:
            return {
                'status': 'warning',
                'explanation': explanation,
                'how_to_fix': f'Error checking domain age: {e}',
                'age_days': None,
                'created': None
            }

    @classmethod
    def analyze_email(cls, email: str, dkim_selector: Optional[str] = None, sending_ip: str = None) -> Dict[str, Any]:
        domain = cls.extract_domain(email)
        # Block free/public email domains
        if domain in FREE_EMAIL_DOMAINS:
            return {
                'error': 'Please enter a professional email address (e.g., user@yourcompany.com). Free email addresses like Gmail, Outlook, Yahoo, etc. are not supported for bulk sending checks.'
            }
        spf = cls.check_spf(domain)
        dkim = cls.check_dkim(domain, dkim_selector)
        dmarc = cls.check_dmarc(domain)
        blacklist = cls.check_blacklists(domain, sending_ip)
        # Get IP for PTR
        try:
            ip = socket.gethostbyname(domain)
        except Exception:
            ip = None
        ptr = cls.check_ptr(ip, domain) if ip else {
            'status': 'fail',
            'explanation': 'PTR (reverse DNS) check skipped: could not resolve IP.',
            'how_to_fix': 'Check your domain DNS and try again.',
            'ptr': None
        }
        # PTR shared host explanation
        if ptr['status'] == 'fail' and ptr.get('ptr') and any(x in ptr['ptr'] for x in ['wixsite.com', 'shopify', 'squarespace', 'weebly', 'wordpress']):
            ptr['how_to_fix'] += ' This PTR record indicates your domain is hosted on a website builder (e.g., Wix, Shopify, Squarespace). For best deliverability, use a dedicated email provider (like Google Workspace, Microsoft 365, or a transactional email service) for bulk sending.'
        mx = cls.check_mx(domain)
        domain_age = cls.check_domain_age(domain)

        # Sending volume advice
        advice = []
        if any(check['status'] == 'fail' for check in [spf, dkim, dmarc, blacklist, ptr, mx]):
            advice.append("Your domain or IP is not fully healthy. Fix all errors above before sending bulk emails.")
            advice.append("Once all checks are green, start with 20-50 emails/day and increase by 20% every few days if you see no deliverability issues.")
        elif any(check['status'] == 'warning' for check in [spf, dkim, dmarc, blacklist, ptr, mx, domain_age]):
            advice.append("Your setup is almost ready. Start with a low volume (20-50 emails/day) and increase slowly. Monitor for bounces and spam complaints.")
        elif domain_age['status'] == 'fail':
            advice.append("Your domain is very new. Start with 5-10 emails/day and increase very slowly over several months.")
        else:
            advice.append("Your domain and IP are healthy! You can start with 50-100 emails/day and increase by 20% every few days if you see no issues.")
        advice.append("Always monitor your open rates, bounces, and spam complaints. If you see problems, pause and investigate.")

        summary = {
            'domain': domain,
            'checks': {
                'SPF': spf,
                'DKIM': dkim,
                'DMARC': dmarc,
                'BLACKLIST': blacklist,
                'PTR': ptr,
                'MX': mx,
                'DOMAIN_AGE': domain_age
            },
            'sending_volume_advice': ' '.join(advice)
        }
        # Add global alerts
        alerts = []
        for name, check in summary['checks'].items():
            if name == 'BLACKLIST':
                if check.get('ip_blacklisted_on') or check.get('domain_blacklisted_on'):
                    links = []
                    for rbl in (check.get('ip_blacklisted_on') or []) + (check.get('domain_blacklisted_on') or []):
                        link = RBL_DELIST_LINKS.get(rbl)
                        if link:
                            links.append(f"<a href='{link}' target='_blank'>{rbl}</a>")
                        else:
                            links.append(rbl)
                    alerts.append({
                        'level': 'error',
                        'message': f"Your domain ({check.get('checked_domain')}) or sending IP ({check.get('checked_ip')}) is blacklisted on: {', '.join(links)}. Request delisting or contact your provider. If this is not your actual sending IP, please check the IP shown in your email headers for the most accurate result."
                    })
                else:
                    alerts.append({
                        'level': 'info',
                        'message': 'Your domain and (if provided) sending IP are not blacklisted in major RBLs.'
                    })
            elif check['status'] == 'fail':
                alerts.append({
                    'level': 'error',
                    'message': f"{name} check failed: {check['how_to_fix']}"
                })
            elif check['status'] == 'warning':
                alerts.append({
                    'level': 'warning',
                    'message': f"{name} warning: {check['how_to_fix']}"
                })
        # Add user guidance for sending IP
        alerts.append({
            'level': 'info',
            'message': 'For the most accurate blacklist check, provide your actual sending IP address (the IP shown in the Received header of your sent email). If you use Google Workspace, Microsoft 365, or a bulk email provider, this is not your website IP. Learn how to find your sending IP: https://mxtoolbox.com/Public/Content/EmailHeaders/'
        })
        summary['alerts'] = alerts
        return summary 