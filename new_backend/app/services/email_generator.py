import logging
import os
from typing import Dict, Any, Optional, List
import json
import requests
from urllib.parse import urlparse
from openai import AzureOpenAI
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from sqlalchemy import or_
import uuid
import re

from app.models.models import GeneratedEmail, User, EmailTemplate, EmailGenerationProgress, Attachment

# --- Environment Variable Configuration ---
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_DEPLOYMENT_NAME = os.getenv("AZURE_DEPLOYMENT_NAME", "Avocat")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# --- Initialize Logger ---
logger = logging.getLogger(__name__)

class WebScraper:
    """Class for extracting information from company websites."""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        })
    
    def extract_info(self, url: str) -> Dict[str, Any]:
        """Extract relevant information from a company website"""
        if not url or url.strip() == "":
            return {"success": False, "error": "No URL provided", "data": {}}
        
        parsed_url = urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            return {"success": False, "error": "Invalid URL", "data": {}}
        
        try:
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
        if not all([AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT]):
            raise ValueError("Azure OpenAI credentials are not configured in environment variables.")
        self.client = AzureOpenAI(
            api_key=AZURE_OPENAI_API_KEY,
            api_version="2023-12-01-preview",
            azure_endpoint=AZURE_OPENAI_ENDPOINT
        )
        self.scraper = WebScraper()
    
    def extract_website_info(self, website_url: str) -> str:
        """Extract relevant information from a company website"""
        info = self.scraper.extract_info(website_url)
        
        if not info["success"]:
            return f"Failed to extract information: {info.get('error', 'Unknown error')}"
        
        data = info["data"]
        return f"""
        About: {data.get('about', 'Not available')}
        
        Key Products/Services: {', '.join(data.get('key_products', ['Not available']))}
        
        Company Values: {', '.join(data.get('company_values', ['Not available']))}
        
        Recent News: {data.get('recent_news', 'Not available')}
        """
    
    def generate_personalized_email(
        self,
        contact_data: Dict[str, Any],
        user: User,
        template: Optional[EmailTemplate] = None,
        stage: str = "outreach",
        progress_id: Optional[int] = None,
        group_id: Optional[str] = None
    ) -> GeneratedEmail:
        """Generate a personalized email using Azure OpenAI API"""
        
        # If no template provided, try to get the default template for this stage
        if not template:
            template = self.db.query(EmailTemplate).filter(
                EmailTemplate.user_id == user.id,
                EmailTemplate.category == stage,
                EmailTemplate.is_default == True
            ).first()
        
        # Extract information from company website
        website_info = self.scraper.extract_info(contact_data.get("Website", ""))
        
        # Build context for OpenAI API
        if template:
            # Use template as a prompt for ChatGPT
            template_content = template.content
            
            # Replace placeholders in template with actual data for the prompt
            template_content = template_content.replace("[Recipient Name]", contact_data.get('First Name', '') + ' ' + contact_data.get('Last Name', ''))
            template_content = template_content.replace("[Company Name]", contact_data.get('Company', ''))
            template_content = template_content.replace("[Your Name]", user.full_name if user.full_name else "[Your Name]")
            template_content = template_content.replace("[Your Position]", user.position if user.position else "[Your Position]")
            template_content = template_content.replace("[Your Company]", user.company_name if user.company_name else "[Your Company]")
            
            prompt = f"""
            Rewrite this email template in the same style without syntax or grammatical mistakes, using the web scraping knowledge and names in the list given to you. Personalize it based on the recipient's information and company details.
            
            Template to rewrite:
            {template_content}
            
            Recipient Information:
            First Name: {contact_data.get('First Name', '')}
            Last Name: {contact_data.get('Last Name', '')}
            Title: {contact_data.get('Title', '')}
            Company: {contact_data.get('Company', '')}
            Industry: {contact_data.get('Industry', '')}
            Keywords: {contact_data.get('Keywords', '')}
            SEO Description: {contact_data.get('SEO Description', '')}
            
            Company Information from Web Scraping:
            {website_info}
            
            Sender Information:
            Name: {user.full_name if user.full_name else "[Your Name]"}
            Position: {user.position if user.position else "[Your Position]"}
            Company: {user.company_name if user.company_name else "[Your Company]"}
            Company Description: {user.company_description if user.company_description else "[brief description of company]"}
            
            Stage: {stage}
            
            Please:
            1. Maintain the same tone and style as the template
            2. Personalize it with the recipient's specific information
            3. Incorporate relevant details from the web scraping
            4. Ensure proper grammar and syntax
            5. Keep the same structure and flow as the original template
            6. If a company description is provided, use it to explain how your company's offerings align with the recipient's needs
            7. Do not use any markdown formatting (like ** or *) in the email content
            8. Avoid using em dashes (—) - use regular dashes (-) or other appropriate punctuation instead
            9. DO NOT let variables like [Your Name] or [Your Position] be in the email content. Always use the data given to you about sender and recipient.
            10. DO NOT add a written signature to the email if not present in the given prompt.
            """
        else:
            # Use hardcoded prompt as fallback
            prompt = f"""
            Create a personalized outreach email in English for:
            
            First Name: {contact_data.get('First Name', '')}
            Last Name: {contact_data.get('Last Name', '')}
            Title: {contact_data.get('Title', '')}
            Company: {contact_data.get('Company', '')}
            Industry: {contact_data.get('Industry', '')}
            Keywords: {contact_data.get('Keywords', '')}
            SEO Description: {contact_data.get('SEO Description', '')}
            
            Company Information:
            {website_info}
            
            Sender Information:
            Name: [Your Name]
            Position: [Your Position]
            Company: [Your Company]
            Company Description: {user.company_description if user.company_description else "[brief description of company]"}
            
            Stage: {stage}
            
            Please generate a professional, personalized email that:
            1. References specific details about the recipient's company
            2. Demonstrates understanding of their industry
            3. Maintains a professional yet engaging tone
            4. Includes a clear call to action
            5. Is concise and to the point (aim for 3-4 short paragraphs maximum)
            6. If a company description is provided, use it to explain how your company's offerings align with the recipient's needs
            7. Avoid unnecessary details and keep the message focused on value proposition
            8. Avoid using em dashes (—) - use regular dashes (-) or other appropriate punctuation instead
            """
        
        try:
            response = self.client.chat.completions.create(
                model=AZURE_DEPLOYMENT_NAME,
                messages=[
                    {"role": "system", "content": "You are an expert email writer specializing in professional outreach. When a company description is provided, use it to explain how the sender's offerings align with the recipient's needs. Do not use any markdown formatting (like ** or *) in the email content."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            
            # If we get a successful response (200 OK), update the progress.
            if progress_id:
                progress_record = self.db.query(EmailGenerationProgress).filter(
                    EmailGenerationProgress.id == progress_id
                ).first()
                if progress_record:
                    progress_record.generated_emails += 1
                    self.db.commit()
            
            generated_content = response.choices[0].message.content
            
            # Extract subject from first line of content and remove "Subject: " prefix if present
            content_lines = generated_content.split('\n')
            subject = ""
            # Robustly find the subject line
            for line in content_lines:
                if line.lower().strip().startswith("subject:"):
                    subject = line.strip()[8:].strip()
                    break
            if not subject:
                subject = content_lines[0].strip() # Fallback to first line
            
            # Find the "Best regards" line and remove everything after it
            content = []
            for line in content_lines[1:]:
                if line.strip().lower() == "best regards,":
                    break
                content.append(line)
            
            # Join the content and add the correct signature
            content = '\n'.join(content).strip()
            
            # Remove any markdown formatting (more robustly)
            content = content.replace("**", "").replace("_", "").replace("*", "")
            
            # Replace placeholders with user information if available
            content = content.replace("[Your Name]", user.full_name if user.full_name else "[Your Name]")
            content = content.replace("[Your Position]", user.position if user.position else "[Your Position]")
            content = content.replace("[Your Company]", user.company_name if user.company_name else "[Your Company]")
            
            # Remove any existing signature lines after "Best regards" or similar phrases
            content_lines = content.split('\n')
            new_content = []
            signature_indicators = ["best regards", "sincerely", "kind regards", "warm regards", "looking forward", "thank you"]
            
            for line in content_lines:
                line_lower = line.strip().lower()
                if any(indicator in line_lower for indicator in signature_indicators):
                    break
                new_content.append(line)
            
            content = '\n'.join(new_content).strip()
            
            # Set status based on stage (applies for all code paths)
            status = "outreach_pending"
            if stage == "followup":
                status = "followup_due"
            elif stage == "lastchance":
                status = "lastchance_due"
            
            # --- Attachment placeholder replacement ---
            # Query all attachments for the user and replace [Placeholder] with the correct HTML tag
            attachments = self.db.query(Attachment).filter_by(user_id=user.id).all()
            for att in attachments:
                if att.placeholder:
                    html_tag = att.blob_url
                    if att.file_type.lower().startswith("image"):
                        html_tag = f'<img src="{att.blob_url}" style="max-width:300px; height:auto;" alt="Attachment" />'
                    elif att.file_type.lower().startswith("video"):
                        # Use the watch page URL for videos instead of direct blob URL
                        watch_url = f"{FRONTEND_URL}/watch?src={att.blob_url}&title={att.placeholder}"
                        if getattr(att, 'gif_url', None):
                            html_tag = (
                                f'<a href="{watch_url}" target="_blank" rel="noopener">'
                                f'  <img src="{att.gif_url}" alt="\u25B6\ufe0f Watch video" '
                                f'       style="max-width:300px; height:auto; display:block; margin:0 auto;" />'
                                f'</a>'
                            )
                        else:
                            # Fallback to direct video link if no GIF
                            html_tag = f'<a href="{watch_url}" target="_blank" rel="noopener">Watch Video</a>'
                    # Replace [Placeholder] and [placeholder] (case-insensitive)
                    content = re.sub(rf"\\[{att.placeholder}\\]", html_tag, content, flags=re.IGNORECASE)
                    subject = re.sub(rf"\\[{att.placeholder}\\]", html_tag, subject, flags=re.IGNORECASE)
            
            # Create and save the generated email
            email = GeneratedEmail(
                recipient_email=contact_data.get("Email", ""),
                recipient_name=f"{contact_data.get('First Name', '')} {contact_data.get('Last Name', '')}",
                recipient_company=contact_data.get("Company", ""),
                subject=subject,
                content=content,
                user_id=user.id,
                template_id=template.id if template else None,
                status=status,
                stage=stage,
                follow_up_status="none",
                # This field is now the single source of truth for the next action due date
                follow_up_date=datetime.now(timezone.utc) + timedelta(days=user.followup_interval_days or 3),
                created_at=datetime.now(timezone.utc),
                # Set legacy fields for backward compatibility
                to=contact_data.get("Email", ""),
                body=content,
                group_id=group_id
            )
            
            self.db.add(email)
            self.db.commit()
            self.db.refresh(email)
            
            return email
            
        except Exception as e:
            raise Exception(f"Failed to generate email: {str(e)}")
    
    def process_csv_data(
        self,
        csv_data: List[Dict[str, Any]],
        user: User,
        template: Optional[EmailTemplate] = None,
        stage: str = "outreach",
        avoid_duplicates: bool = False,
        dedupe_with_friends: bool = False,
        friends_ids: Optional[List[int]] = None,
        group_id: Optional[str] = None
    ) -> List[GeneratedEmail]:
        # Generate group_id if not provided
        if not group_id:
            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            group_id = f"batch-{timestamp}-{str(uuid.uuid4())[:8]}"
        
        generated_emails = []
        already_emailed = set()
        
        # Build set of already emailed addresses for this user (and optionally friends)
        if avoid_duplicates:
            # Check GeneratedEmail table for all previous communications
            conditions = [GeneratedEmail.user_id == user.id]
            if dedupe_with_friends and friends_ids:
                conditions.append(GeneratedEmail.user_id.in_(friends_ids))
            
            # Get emails from GeneratedEmail table
            query = self.db.query(GeneratedEmail.recipient_email).filter(or_(*conditions))
            emails = {r[0].lower() for r in query if r[0]}
            already_emailed.update(emails)

        for i, contact in enumerate(csv_data):
            email_addr = contact.get("Email", "").lower()
            if not email_addr:
                continue
            if avoid_duplicates and email_addr in already_emailed:
                continue
            try:
                email = self.generate_personalized_email(contact, user, template, stage, None, group_id)
                generated_emails.append(email)
                if avoid_duplicates:
                    already_emailed.add(email_addr)
                
            except Exception as e:
                print(f"Error generating email for {email_addr}: {str(e)}")
                
        return generated_emails

    def generate_followup_email(
        self,
        original_email: GeneratedEmail,
        user: User,
        template: Optional[EmailTemplate] = None
    ) -> GeneratedEmail:
        """Generate a personalized follow-up email using AI, always rewriting the template if present."""
        logger = logging.getLogger(__name__)
        # Check if a follow-up already exists for this recipient
        existing_followup = self.db.query(GeneratedEmail).filter(
            GeneratedEmail.recipient_email == original_email.recipient_email,
            GeneratedEmail.stage == "followup",
            GeneratedEmail.user_id == user.id
        ).first()
        if existing_followup:
            logger.warning(f"Follow-up already exists for {original_email.recipient_email}, skipping generation")
            return existing_followup
        # If no template provided, try to get the default template for followup category
        if not template:
            template = self.db.query(EmailTemplate).filter(
                EmailTemplate.user_id == user.id,
                EmailTemplate.category == "followup",
                EmailTemplate.is_default == True
            ).first()
        if not template:
            raise ValueError("Cannot generate follow-up: No default follow-up template found.")
        # Extract information from the original email
        recipient_name = original_email.recipient_name
        recipient_company = original_email.recipient_company
        recipient_email = original_email.recipient_email
        # Always use AI rewriting, using the template as a base
        template_content = template.content
        template_content = template_content.replace("[Recipient Name]", recipient_name)
        template_content = template_content.replace("[Company Name]", recipient_company)
        template_content = template_content.replace("[Your Name]", user.full_name if user.full_name else "[Your Name]")
        template_content = template_content.replace("[Your Position]", user.position if user.position else "[Your Position]")
        template_content = template_content.replace("[Your Company]", user.company_name if user.company_name else "[Your Company]")
        prompt = f"""
        Rewrite this follow-up email template in the same style without syntax or grammatical mistakes, using the information and names in the list given to you. Personalize it based on the recipient's information and company details.
        Template to rewrite:
        {template_content}
        Recipient Information:
        Name: {recipient_name}
        Company: {recipient_company}
        Email: {recipient_email}
        Original Email Subject: {original_email.subject}
        Original Email Content: {original_email.content}
        Sender Information:
        Name: {user.full_name if user.full_name else '[Your Name]'}
        Position: {user.position if user.position else '[Your Position]'}
        Company: {user.company_name if user.company_name else '[Your Company]'}
        Company Description: {user.company_description if user.company_description else '[brief description of company]'}
        Stage: followup
        Please:
        1. Maintain the same tone and style as the template
        2. Personalize it with the recipient's specific information
        3. Incorporate relevant details if available
        4. Ensure proper grammar and syntax
        5. Keep the same structure and flow as the original template
        6. If a company description is provided, use it to explain how your company's offerings align with the recipient's needs
        7. Do not use any markdown formatting (like ** or *) in the email content
        8. Avoid using em dashes (—) - use regular dashes (-) or other appropriate punctuation instead
        9. DO NOT let variables like [Your Name] or [Your Position] be in the email content. Always use the data given to you about sender and recipient.
        10. DO NOT add a written signature to the email if not present in the given prompt.
        """
        try:
            response = self.client.chat.completions.create(
                model=AZURE_DEPLOYMENT_NAME,
                messages=[
                    {"role": "system", "content": "You are an expert email writer specializing in professional follow-up emails. Create emails that add value and feel natural, not pushy. Do not use any markdown formatting (like ** or *) in the email content."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            generated_content = response.choices[0].message.content
            # Extract subject from first line of content and remove "Subject: " prefix if present
            content_lines = generated_content.split('\n')
            subject = content_lines[0].strip()
            if subject.lower().startswith("subject: "):
                subject = subject[9:].strip()
            # Find the "Best regards" line and remove everything after it
            content = []
            for line in content_lines[1:]:
                if line.strip().lower() == "best regards,":
                    break
                content.append(line)
            content = '\n'.join(content).strip()
            # Remove any markdown formatting
            content = content.replace("**", "")
            # Replace placeholders with user information if available
            content = content.replace("[Your Name]", user.full_name if user.full_name else "[Your Name]")
            content = content.replace("[Your Position]", user.position if user.position else "[Your Position]")
            content = content.replace("[Your Company]", user.company_name if user.company_name else "[Your Company]")
            # Remove any existing signature lines after "Best regards" or similar phrases
            content_lines = content.split('\n')
            new_content = []
            signature_indicators = ["best regards", "sincerely", "kind regards", "warm regards", "looking forward", "thank you"]
            for line in content_lines:
                line_lower = line.strip().lower()
                if any(indicator in line_lower for indicator in signature_indicators):
                    break
                new_content.append(line)
            content = '\n'.join(new_content).strip()
        except Exception as e:
            raise Exception(f"Failed to generate follow-up email: {str(e)}")
        # --- Attachment placeholder replacement with logging ---
        attachments = self.db.query(Attachment).filter_by(user_id=user.id).all()
        for att in attachments:
            if att.placeholder:
                html_tag = att.blob_url
                if att.file_type.lower().startswith("image"):
                    html_tag = f'<img src="{att.blob_url}" style="max-width:300px; height:auto;" alt="Attachment" />'
                elif att.file_type.lower().startswith("video"):
                    # Use the watch page URL for videos instead of direct blob URL
                    watch_url = f"{FRONTEND_URL}/watch?src={att.blob_url}&title={att.placeholder}"
                    if getattr(att, 'gif_url', None):
                        html_tag = (
                            f'<a href="{watch_url}" target="_blank" rel="noopener">'
                            f'  <img src="{att.gif_url}" alt="\u25B6\ufe0f Watch video" '
                            f'       style="max-width:300px; height:auto; display:block; margin:0 auto;" />'
                            f'</a>'
                        )
                    else:
                        # Fallback to direct video link if no GIF
                        html_tag = f'<a href="{watch_url}" target="_blank" rel="noopener">Watch Video</a>'
                # Log before replacement
                if re.search(rf"\\[{att.placeholder}\\]", content, flags=re.IGNORECASE):
                    logger.info(f"Replacing placeholder [{att.placeholder}] with HTML tag in follow-up email.")
                else:
                    logger.warning(f"Placeholder [{att.placeholder}] not found in follow-up email content.")
                content = re.sub(rf"\\[{att.placeholder}\\]", html_tag, content, flags=re.IGNORECASE)
                subject = re.sub(rf"\\[{att.placeholder}\\]", html_tag, subject, flags=re.IGNORECASE)
        # Get user's interval settings for scheduling
        now = datetime.now(timezone.utc)
        followup_days = user.followup_interval_days or 3
        followup_email = GeneratedEmail(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            recipient_company=recipient_company,
            subject=subject,
            content=content,
            user_id=user.id,
            template_id=template.id if template else None,
            status="followup_due",
            stage="followup",
            followup_due_at=now + timedelta(days=followup_days),
            created_at=now,
            to=recipient_email,
            body=content,
            group_id=original_email.group_id
        )
        self.db.add(followup_email)
        self.db.commit()
        self.db.refresh(followup_email)
        return followup_email

    def generate_lastchance_email(
        self,
        original_email: GeneratedEmail,
        user: User,
        template: Optional[EmailTemplate] = None
    ) -> GeneratedEmail:
        """Generate a last chance email based on an original email, always using AI rewriting and web scraping."""
        # Check if a lastchance already exists for this recipient
        existing_lastchance = self.db.query(GeneratedEmail).filter(
            GeneratedEmail.recipient_email == original_email.recipient_email,
            GeneratedEmail.stage == "lastchance",
            GeneratedEmail.user_id == user.id
        ).first()
        if existing_lastchance:
            logger.warning(f"Lastchance already exists for {original_email.recipient_email}, skipping generation")
            return existing_lastchance

        # If no template provided, try to get the default template for lastchance category
        if not template:
            template = self.db.query(EmailTemplate).filter(
                EmailTemplate.user_id == user.id,
                EmailTemplate.category == "lastchance",
                EmailTemplate.is_default == True
            ).first()

        # Extract information from the original email
        recipient_name = original_email.recipient_name
        recipient_company = original_email.recipient_company
        recipient_email = original_email.recipient_email
        website_info = self.scraper.extract_info(recipient_company) if recipient_company else {}
        website_info_str = ""
        if website_info and website_info.get("success"):
            data = website_info["data"]
            website_info_str = f"""
            About: {data.get('about', 'Not available')}
            Key Products/Services: {', '.join(data.get('key_products', ['Not available']))}
            Company Values: {', '.join(data.get('company_values', ['Not available']))}
            Recent News: {data.get('recent_news', 'Not available')}
            """
        else:
            website_info_str = f"Failed to extract information: {website_info.get('error', 'Unknown error')}" if website_info else "No company info available."

        # Prepare the template content with placeholders replaced
        template_content = template.content if template else ""
        if template_content:
            template_content = template_content.replace("[Recipient Name]", recipient_name or "")
            template_content = template_content.replace("[Company Name]", recipient_company or "")
            template_content = template_content.replace("[Your Name]", user.full_name if user.full_name else "[Your Name]")
            template_content = template_content.replace("[Your Position]", user.position if user.position else "[Your Position]")
            template_content = template_content.replace("[Your Company]", user.company_name if user.company_name else "[Your Company]")

        # Build the AI prompt (always use AI, even if template exists)
        prompt = f"""
        Rewrite this last chance email template in the same style without syntax or grammatical mistakes, using the web scraping knowledge and names in the list given to you. Personalize it based on the recipient's information and company details.
        
        Template to rewrite:
        {template_content if template_content else '[No template provided]'}
        
        Recipient Information:
        Name: {recipient_name}
        Company: {recipient_company}
        Email: {recipient_email}
        
        Original Email Subject: {original_email.subject}
        Original Email Content: {original_email.content}
        
        Company Information from Web Scraping:
        {website_info_str}
        
        Sender Information:
        Name: {user.full_name if user.full_name else '[Your Name]'}
        Position: {user.position if user.position else '[Your Position]'}
        Company: {user.company_name if user.company_name else '[Your Company]'}
        Company Description: {user.company_description if user.company_description else '[brief description of company]'}
        
        Stage: lastchance
        
        Please:
        1. Maintain the same tone and style as the template
        2. Personalize it with the recipient's specific information
        3. Incorporate relevant details from the web scraping
        4. Ensure proper grammar and syntax
        5. Keep the same structure and flow as the original template
        6. If a company description is provided, use it to explain how your company's offerings align with the recipient's needs
        7. Do not use any markdown formatting (like ** or *) in the email content
        8. Avoid using em dashes (—) - use regular dashes (-) or other appropriate punctuation instead
        9. DO NOT let variables like [Your Name] or [Your Position] be in the email content. Always use the data given to you about sender and recipient.
        10. DO NOT add a written signature to the email if not present in the given prompt.
        11. Make it clear this is the final follow-up attempt, but remain polite and professional.
        """

        try:
            response = self.client.chat.completions.create(
                model=AZURE_DEPLOYMENT_NAME,
                messages=[
                    {"role": "system", "content": "You are an expert email writer specializing in professional final follow-up emails. When a company description is provided, use it to explain how the sender's offerings align with the recipient's needs. Do not use any markdown formatting (like ** or *) in the email content."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            generated_content = response.choices[0].message.content
            # Extract subject from first line of content and remove "Subject: " prefix if present
            content_lines = generated_content.split('\n')
            subject = content_lines[0].strip()
            if subject.lower().startswith("subject: "):
                subject = subject[9:].strip()
            # Find the "Best regards" line and remove everything after it
            content = []
            for line in content_lines[1:]:
                if line.strip().lower() == "best regards,":
                    break
                content.append(line)
            # Join the content and add the correct signature
            content = '\n'.join(content).strip()
            # Remove any markdown formatting
            content = content.replace("**", "")
            # Replace placeholders with user information if available
            content = content.replace("[Your Name]", user.full_name if user.full_name else "[Your Name]")
            content = content.replace("[Your Position]", user.position if user.position else "[Your Position]")
            content = content.replace("[Your Company]", user.company_name if user.company_name else "[Your Company]")
            # Remove any existing signature lines after "Best regards" or similar phrases
            content_lines = content.split('\n')
            new_content = []
            signature_indicators = ["best regards", "sincerely", "kind regards", "warm regards", "looking forward", "thank you"]
            for line in content_lines:
                line_lower = line.strip().lower()
                if any(indicator in line_lower for indicator in signature_indicators):
                    break
                new_content.append(line)
            content = '\n'.join(new_content).strip()
        except Exception as e:
            raise Exception(f"Failed to generate last chance email: {str(e)}")

        # --- Attachment placeholder replacement ---
        # Query all attachments for the user and replace [Placeholder] with the correct HTML tag
        attachments = self.db.query(Attachment).filter_by(user_id=user.id).all()
        for att in attachments:
            if att.placeholder:
                html_tag = att.blob_url
                if att.file_type.lower().startswith("image"):
                    html_tag = f'<img src="{att.blob_url}" style="max-width:300px; height:auto;" alt="Attachment" />'
                elif att.file_type.lower().startswith("video"):
                    # Use the watch page URL for videos instead of direct blob URL
                    watch_url = f"{FRONTEND_URL}/watch?src={att.blob_url}&title={att.placeholder}"
                    if getattr(att, 'gif_url', None):
                        html_tag = (
                            f'<a href="{watch_url}" target="_blank" rel="noopener">'
                            f'  <img src="{att.gif_url}" alt="\u25B6\ufe0f Watch video" '
                            f'       style="max-width:300px; height:auto; display:block; margin:0 auto;" />'
                            f'</a>'
                        )
                    else:
                        # Fallback to direct video link if no GIF
                        html_tag = f'<a href="{watch_url}" target="_blank" rel="noopener">Watch Video</a>'
                # Replace [Placeholder] and [placeholder] (case-insensitive)
                content = re.sub(rf"\\[{att.placeholder}\\]", html_tag, content, flags=re.IGNORECASE)
                subject = re.sub(rf"\\[{att.placeholder}\\]", html_tag, subject, flags=re.IGNORECASE)
        
        # Get user's interval settings for scheduling
        now = datetime.now(timezone.utc)
        lastchance_days = user.lastchance_interval_days or 6
        # Create the last chance email
        lastchance_email = GeneratedEmail(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            recipient_company=recipient_company,
            subject=subject,
            content=content,
            user_id=user.id,
            template_id=template.id if template else None,
            status="lastchance_due", # Set status to 'lastchance_due'
            stage="lastchance",
            # Use the correct field names for due dates
            lastchance_due_at=now + timedelta(days=lastchance_days),
            created_at=now,
            # Set legacy fields for backward compatibility
            to=recipient_email,
            body=content,
            group_id=original_email.group_id  # Inherit group_id from original email
        )
        self.db.add(lastchance_email)
        self.db.commit()
        self.db.refresh(lastchance_email)
        return lastchance_email

    def mark_generation_complete(self, progress_id: int):
        """
        Finalizes the generation process by updating the progress record.
        This ensures the UI gets a 'completed' status even for very fast jobs.
        """
        try:
            progress_record = self.db.query(EmailGenerationProgress).filter(
                EmailGenerationProgress.id == progress_id
            ).first()
            if progress_record:
                # Ensure the generated count matches the processed count upon completion
                progress_record.generated_emails = progress_record.processed_contacts
                progress_record.status = "completed"
                self.db.commit()
        except Exception as e:
            logger.error(f"Error marking generation as complete for progress_id {progress_id}: {e}")

    async def regenerate_email_content(self, email: GeneratedEmail, user: User, custom_prompt: str) -> GeneratedEmail:
        """Re-generates the subject and content of an existing email using a new prompt, with placeholder replacement."""
        # Use the same logic as generate_lastchance_email for lastchance stage
        if email.stage == "lastchance":
            # Try to get the template if it exists
            template = self.db.query(EmailTemplate).filter(
                EmailTemplate.user_id == user.id,
                EmailTemplate.category == "lastchance",
                EmailTemplate.is_default == True
            ).first()
            template_content = template.content if template else ""
            if template_content:
                template_content = template_content.replace("[Recipient Name]", email.recipient_name or "")
                template_content = template_content.replace("[Company Name]", email.recipient_company or "")
                template_content = template_content.replace("[Your Name]", user.full_name if user.full_name else "[Your Name]")
                template_content = template_content.replace("[Your Position]", user.position if user.position else "[Your Position]")
                template_content = template_content.replace("[Your Company]", user.company_name if user.company_name else "[Your Company]")
            # Web scraping/company info
            website_info = self.scraper.extract_info(email.recipient_company) if email.recipient_company else {}
            website_info_str = ""
            if website_info and website_info.get("success"):
                data = website_info["data"]
                website_info_str = f"""
                About: {data.get('about', 'Not available')}
                Key Products/Services: {', '.join(data.get('key_products', ['Not available']))}
                Company Values: {', '.join(data.get('company_values', ['Not available']))}
                Recent News: {data.get('recent_news', 'Not available')}
                """
            else:
                website_info_str = f"Failed to extract information: {website_info.get('error', 'Unknown error')}" if website_info else "No company info available."
            # Build the AI prompt
            prompt = f"""
            Rewrite this last chance email template in the same style without syntax or grammatical mistakes, using the web scraping knowledge and names in the list given to you. Personalize it based on the recipient's information and company details.
            
            Template to rewrite:
            {template_content if template_content else '[No template provided]'}
            
            Recipient Information:
            Name: {email.recipient_name}
            Company: {email.recipient_company}
            Email: {email.recipient_email}
            
            Original Email Subject: {email.subject}
            Original Email Content: {email.content}
            
            Company Information from Web Scraping:
            {website_info_str}
            
            Sender Information:
            Name: {user.full_name if user.full_name else '[Your Name]'}
            Position: {user.position if user.position else '[Your Position]'}
            Company: {user.company_name if user.company_name else '[Your Company]'}
            Company Description: {user.company_description if user.company_description else '[brief description of company]'}
            
            Stage: lastchance
            
            Please:
            1. Maintain the same tone and style as the template
            2. Personalize it with the recipient's specific information
            3. Incorporate relevant details from the web scraping
            4. Ensure proper grammar and syntax
            5. Keep the same structure and flow as the original template
            6. If a company description is provided, use it to explain how your company's offerings align with the recipient's needs
            7. Do not use any markdown formatting (like ** or *) in the email content
            8. Avoid using em dashes (—) - use regular dashes (-) or other appropriate punctuation instead
            9. DO NOT let variables like [Your Name] or [Your Position] be in the email content. Always use the data given to you about sender and recipient.
            10. DO NOT add a written signature to the email if not present in the given prompt.
            11. Make it clear this is the final follow-up attempt, but remain polite and professional.
            """
            try:
                response = self.client.chat.completions.create(
                    model=AZURE_DEPLOYMENT_NAME,
                    messages=[
                        {"role": "system", "content": "You are an expert email writer specializing in professional final follow-up emails. When a company description is provided, use it to explain how the sender's offerings align with the recipient's needs. Do not use any markdown formatting (like ** or *) in the email content."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.7,
                    max_tokens=1000
                )
                generated_content = response.choices[0].message.content
                # Extract subject from first line of content and remove "Subject: " prefix if present
                content_lines = generated_content.split('\n')
                new_subject = content_lines[0].strip()
                if new_subject.lower().startswith("subject: "):
                    new_subject = new_subject[9:].strip()
                # Find the "Best regards" line and remove everything after it
                content = []
                for line in content_lines[1:]:
                    if line.strip().lower() == "best regards,":
                        break
                    content.append(line)
                # Join the content and add the correct signature
                new_body = '\n'.join(content).strip()
                # Remove any markdown formatting
                new_body = new_body.replace("**", "")
                # Replace placeholders with user information if available
                new_body = new_body.replace("[Your Name]", user.full_name if user.full_name else "[Your Name]")
                new_body = new_body.replace("[Your Position]", user.position if user.position else "[Your Position]")
                new_body = new_body.replace("[Your Company]", user.company_name if user.company_name else "[Your Company]")
                # Remove any existing signature lines after "Best regards" or similar phrases
                content_lines = new_body.split('\n')
                new_content = []
                signature_indicators = ["best regards", "sincerely", "kind regards", "warm regards", "looking forward", "thank you"]
                for line in content_lines:
                    line_lower = line.strip().lower()
                    if any(indicator in line_lower for indicator in signature_indicators):
                        break
                    new_content.append(line)
                new_body = '\n'.join(new_content).strip()
                # Update the email object
                email.subject = new_subject
                email.body = new_body
                email.content = new_body
                self.db.commit()
                self.db.refresh(email)
                return email
            except Exception as e:
                logger.error(f"Error re-generating last chance email for ID {email.id}: {e}")
                raise Exception(f"Failed to re-generate last chance email: {str(e)}")
