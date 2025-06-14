import os
from typing import Dict, Any, Optional, List
import requests
from urllib.parse import urlparse
from openai import AzureOpenAI
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.models.models import GeneratedEmail, User, EmailTemplate

# Read config from environment or fallback to defaults
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "65f3a3cbcc54451d9ae6b8740303c648")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "https://francecentral.api.cognitive.microsoft.com/")
AZURE_DEPLOYMENT_NAME = os.getenv("AZURE_DEPLOYMENT_NAME", "Avocat")

class WebScraper:
    """Extracts information from company websites."""
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        })

    def extract_info(self, url: str) -> Dict[str, Any]:
        if not url or url.strip() == "":
            return {"success": False, "error": "No URL provided", "data": {}}
        parsed_url = urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            return {"success": False, "error": "Invalid URL", "data": {}}
        try:
            # In a real implementation, you could scrape the website for info here.
            domain = url.split('://')[-1].split('/')[0]
            return {
                "success": True,
                "data": {
                    "about": f"Company with website {domain}",
                    "key_products": ["Product 1", "Product 2", "Service 1"],
                    "company_values": ["Innovation", "Quality", "Customer service"],
                    "recent_news": "No recent news available."
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e), "data": {}}

class EmailGenerator:
    def __init__(self, db: Session):
        self.db = db
        self.client = AzureOpenAI(
            api_key=AZURE_OPENAI_API_KEY,
            api_version="2023-12-01-preview",
            azure_endpoint=AZURE_OPENAI_ENDPOINT
        )
        self.scraper = WebScraper()

    def extract_website_info(self, website_url: str) -> str:
        info = self.scraper.extract_info(website_url)
        if not info["success"]:
            return f"Failed to extract information: {info.get('error', 'Unknown error')}"
        data = info["data"]
        return (
            f"About: {data.get('about', 'Not available')}\n"
            f"Key Products/Services: {', '.join(data.get('key_products', ['Not available']))}\n"
            f"Company Values: {', '.join(data.get('company_values', ['Not available']))}\n"
            f"Recent News: {data.get('recent_news', 'Not available')}\n"
        )

    def generate_personalized_email(
        self,
        contact_data: Dict[str, Any],
        user: User,
        template: Optional[EmailTemplate] = None,
        stage: str = "outreach"
    ) -> GeneratedEmail:
        # Extract information from company website
        website_info = self.extract_website_info(contact_data.get("Website", ""))

        # Build prompt
        prompt = (
            f"Create a personalized outreach email in English for:\n"
            f"First Name: {contact_data.get('First Name', '')}\n"
            f"Last Name: {contact_data.get('Last Name', '')}\n"
            f"Title: {contact_data.get('Title', '')}\n"
            f"Company: {contact_data.get('Company', '')}\n"
            f"Industry: {contact_data.get('Industry', '')}\n"
            f"Keywords: {contact_data.get('Keywords', '')}\n"
            f"SEO Description: {contact_data.get('SEO Description', '')}\n\n"
            f"Company Information:\n{website_info}\n\n"
            f"Sender Information:\n"
            f"Name: [Your Name]\n"
            f"Position: [Your Position]\n"
            f"Company: [Your Company]\n"
            f"Company Description: {user.company_description if user.company_description else '[brief description of company]'}\n\n"
            f"Stage: {stage}\n\n"
            "Please generate a professional, personalized email that:\n"
            "1. References specific details about the recipient's company\n"
            "2. Demonstrates understanding of their industry\n"
            "3. Maintains a professional yet engaging tone\n"
            "4. Includes a clear call to action\n"
            "5. Is concise and to the point (aim for 3-4 short paragraphs maximum)\n"
            "6. If a company description is provided, use it to explain how your company's offerings align with the recipient's needs\n"
            "7. Avoid unnecessary details and keep the message focused on value proposition\n"
        )

        try:
            response = self.client.chat.completions.create(
                model=AZURE_DEPLOYMENT_NAME,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert email writer specializing in professional outreach. "
                            "When a company description is provided, use it to explain how the sender's offerings align with the recipient's needs. "
                            "Do not use any markdown formatting (like ** or *) in the email content."
                        )
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            generated_content = response.choices[0].message.content

            # Extract subject and content
            content_lines = generated_content.split('\n')
            subject = content_lines[0].strip()
            if subject.lower().startswith("subject: "):
                subject = subject[9:].strip()

            # Remove everything after the first signature line
            signature_indicators = ["best regards", "sincerely", "kind regards", "warm regards", "looking forward", "thank you"]
            content = []
            for line in content_lines[1:]:
                if any(ind in line.strip().lower() for ind in signature_indicators):
                    break
                content.append(line)
            content = '\n'.join(content).replace("**", "")

            # Replace placeholders with user info
            content = content.replace("[Your Name]", user.full_name or "[Your Name]")
            content = content.replace("[Your Position]", user.position or "[Your Position]")
            content = content.replace("[Your Company]", user.company_name or "[Your Company]")

            # Add signature
            signature = f"\nBest regards,\n{user.full_name or '[Your Name]'}\n{user.position or '[Your Position]'}\n{user.company_name or '[Your Company]'}"
            content = f"{content.strip()}\n\n{signature}"

            # Calculate follow-up dates
            now = datetime.utcnow()
            follow_up_date, final_follow_up_date = None, None
            if stage == "outreach":
                follow_up_date = now + timedelta(days=3)
                final_follow_up_date = now + timedelta(days=7)
            elif stage == "followup":
                follow_up_date = now + timedelta(days=2)
                final_follow_up_date = now + timedelta(days=4)
            elif stage == "lastchance":
                follow_up_date = now + timedelta(days=1)
                final_follow_up_date = now + timedelta(days=2)

            email = GeneratedEmail(
                recipient_email=contact_data.get("Email", ""),
                recipient_name=f"{contact_data.get('First Name', '')} {contact_data.get('Last Name', '')}",
                recipient_company=contact_data.get("Company", ""),
                subject=subject,
                content=content,
                user_id=user.id,
                template_id=template.id if template else None,
                status="draft",
                stage=stage,
                follow_up_status="none",
                follow_up_date=follow_up_date,
                final_follow_up_date=final_follow_up_date,
                created_at=now,
                to=contact_data.get("Email", ""),
                body=content
            )
            self.db.add(email)
            self.db.commit()
            self.db.refresh(email)
            return email
        except Exception as e:
            raise Exception(f"Failed to generate email: {str(e)}")

    def process_csv_data(self, csv_data: List[Dict[str, Any]], user: User, template: Optional[EmailTemplate] = None, stage: str = "outreach") -> List[GeneratedEmail]:
        generated_emails = []
        for contact in csv_data:
            try:
                if not contact.get("Email"):
                    print(f"Skipping contact: Missing email address")
                    continue
                if not contact.get("First Name") or not contact.get("Last Name"):
                    print(f"Skipping contact {contact.get('Email')}: Missing name information")
                    continue
                email = self.generate_personalized_email(contact, user, template, stage)
                generated_emails.append(email)
            except Exception as e:
                print(f"Error generating email for {contact.get('Email', '')}: {str(e)}")
        return generated_emails
