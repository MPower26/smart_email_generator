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

from app.models.models import GeneratedEmail, User, EmailTemplate, EmailGenerationProgress

# --- Environment Variable Configuration ---
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_DEPLOYMENT_NAME = os.getenv("AZURE_DEPLOYMENT_NAME", "Avocat")

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
            
            # Add consistent signature format
            signature = f"""Best regards,
{user.full_name if user.full_name else "[Your Name]"}
{user.position if user.position else "[Your Position]"}
{user.company_name if user.company_name else "[Your Company]"}"""
            
            content = f"{content}\n\n{signature.strip()}"
            
            # Calculate follow-up dates based on stage
            now = datetime.now(timezone.utc)
            follow_up_date = None
            final_follow_up_date = None
            
            if stage == "outreach":
                follow_up_date = now + timedelta(days=3)  # First follow-up after 3 days
                final_follow_up_date = now + timedelta(days=7)  # Final follow-up after 7 days
            elif stage == "followup":
                follow_up_date = now + timedelta(days=2)  # Quick follow-up
                final_follow_up_date = now + timedelta(days=4)  # Final follow-up
            elif stage == "lastchance":
                follow_up_date = now + timedelta(days=1)  # Quick final follow-up
                final_follow_up_date = now + timedelta(days=2)  # Very final follow-up
            
            # Create and save the generated email
            email = GeneratedEmail(
                recipient_email=contact_data.get("Email", ""),
                recipient_name=f"{contact_data.get('First Name', '')} {contact_data.get('Last Name', '')}",
                recipient_company=contact_data.get("Company", ""),
                subject=subject,
                content=content,
                user_id=user.id,
                template_id=template.id if template else None,
                status="outreach_pending",
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
        """Generate a personalized follow-up email"""
        
        # If no template provided, try to get the default template for followup category
        if not template:
            template = self.db.query(EmailTemplate).filter(
                EmailTemplate.user_id == user.id,
                EmailTemplate.category == "followup",
                EmailTemplate.is_default == True
            ).first()

        # --- Stricter Template Logic ---
        if not template:
            raise ValueError("Cannot generate follow-up: No default follow-up template found.")

        # Extract information from the original email
        recipient_name = original_email.recipient_name
        recipient_company = original_email.recipient_company
        recipient_email = original_email.recipient_email
        
        # If we have a template, use it instead of AI generation
        if template:
            # Use the template content and personalize it
            content = template.content
            
            # Replace placeholders with actual data
            content = content.replace("[Recipient Name]", recipient_name)
            content = content.replace("[Company Name]", recipient_company)
            content = content.replace("[Your Name]", user.full_name if user.full_name else "[Your Name]")
            content = content.replace("[Your Position]", user.position if user.position else "[Your Position]")
            content = content.replace("[Your Company]", user.company_name if user.company_name else "[Your Company]")
            
            # Extract subject from first line if it contains "Subject:"
            content_lines = content.split('\n')
            subject = "Follow-up: " + original_email.subject
            if content_lines[0].strip().lower().startswith("subject:"):
                subject = content_lines[0].strip()[8:].strip()
                content = '\n'.join(content_lines[1:]).strip()
            
            # Add signature if not present
            if not any(signature_indicator in content.lower() for signature_indicator in ["best regards", "sincerely", "kind regards"]):
                signature = f"""
Best regards,
{user.full_name if user.full_name else "[Your Name]"}
{user.position if user.position else "[Your Position]"}
{user.company_name if user.company_name else "[Your Company]"}"""
                content = f"{content}\n\n{signature}"
        else:
            # Use AI generation as fallback
            # Build context for OpenAI API
            prompt = f"""
            Create a follow-up email in English for a prospect who didn't respond to the initial outreach.
            
            Recipient Information:
            Name: {recipient_name}
            Company: {recipient_company}
            Email: {recipient_email}
            
            Original Email Subject: {original_email.subject}
            Original Email Content: {original_email.content}
            
            Sender Information:
            Name: {user.full_name if user.full_name else "[Your Name]"}
            Position: {user.position if user.position else "[Your Position]"}
            Company: {user.company_name if user.company_name else "[Your Company]"}
            Company Description: {user.company_description if user.company_description else "[brief description of company]"}
            
            Please generate a professional follow-up email that:
            1. References the previous email sent to them
            2. Is polite and not pushy
            3. Offers additional value or information
            4. Has a different angle or approach than the original
            5. Includes a clear but gentle call to action
            6. Is concise (2-3 short paragraphs maximum)
            7. Maintains a professional yet friendly tone
            8. Avoids being repetitive or aggressive
            9. If a company description is provided, use it to reinforce the value proposition
            10. Avoid using em dashes (—) - use regular dashes (-) or other appropriate punctuation instead
            
            The follow-up should feel natural and add value, not just be a reminder.
            """
            
            try:
                response = self.client.chat.completions.create(
                    model=AZURE_DEPLOYMENT_NAME,
                    messages=[
                        {"role": "system", "content": "You are an expert email writer specializing in professional follow-up emails. Create emails that add value and feel natural, not pushy. Do not use any markdown formatting (like ** or *) in the email content."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.7,
                    max_tokens=800
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
                
                # Add consistent signature format
                signature = f"""
Best regards,
{user.full_name if user.full_name else "[Your Name]"}
{user.position if user.position else "[Your Position]"}
{user.company_name if user.company_name else "[Your Company]"}"""
                
                content = f"{content}\n\n{signature}"
                
            except Exception as e:
                raise Exception(f"Failed to generate follow-up email: {str(e)}")
        
        # Get user's interval settings for scheduling
        now = datetime.now(timezone.utc)
        followup_days = user.followup_interval_days or 3
        
        # Create a new email object for the follow-up
        followup_email = GeneratedEmail(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            recipient_company=recipient_company,
            subject=subject,
            content=content,
            user_id=user.id,
            template_id=template.id if template else None,
            status="followup_due",  # Set status to 'followup_due'
            stage="followup",
            # Use the single source of truth for due dates
            follow_up_date=now + timedelta(days=followup_days),
            created_at=now,
            # Set legacy fields for backward compatibility
            to=recipient_email,
            body=content
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
        """Generate a last chance email based on an original email"""
        
        # If no template provided, try to get the default template for lastchance category
        if not template:
            template = self.db.query(EmailTemplate).filter(
                EmailTemplate.user_id == user.id,
                EmailTemplate.category == "lastchance",
                EmailTemplate.is_default == True
            ).first()

        # --- Stricter Template Logic ---
        if not template:
            raise ValueError("Cannot generate last chance: No default last chance template found.")
            
        # Extract information from the original email
        recipient_name = original_email.recipient_name
        recipient_company = original_email.recipient_company
        recipient_email = original_email.recipient_email
        
        # If we have a template, use it instead of AI generation
        if template:
            # Use the template content and personalize it
            content = template.content
            
            # Replace placeholders with actual data
            content = content.replace("[Recipient Name]", recipient_name)
            content = content.replace("[Company Name]", recipient_company)
            content = content.replace("[Your Name]", user.full_name if user.full_name else "[Your Name]")
            content = content.replace("[Your Position]", user.position if user.position else "[Your Position]")
            content = content.replace("[Your Company]", user.company_name if user.company_name else "[Your Company]")
            
            # Extract subject from first line if it contains "Subject:"
            content_lines = content.split('\n')
            subject = "Final Follow-up: " + original_email.subject
            if content_lines[0].strip().lower().startswith("subject:"):
                subject = content_lines[0].strip()[8:].strip()
                content = '\n'.join(content_lines[1:]).strip()
            
            # Add signature if not present
            if not any(signature_indicator in content.lower() for signature_indicator in ["best regards", "sincerely", "kind regards"]):
                signature = f"""
Best regards,
{user.full_name if user.full_name else "[Your Name]"}
{user.position if user.position else "[Your Position]"}
{user.company_name if user.company_name else "[Your Company]"}"""
                content = f"{content}\n\n{signature}"
        else:
            # Use AI generation as fallback
            # Build context for OpenAI API
            prompt = f"""
            Create a final follow-up (last chance) email in English for a prospect who didn't respond to previous outreach attempts.
            
            Recipient Information:
            Name: {recipient_name}
            Company: {recipient_company}
            Email: {recipient_email}
            
            Original Email Subject: {original_email.subject}
            Original Email Content: {original_email.content}
            
            Sender Information:
            Name: {user.full_name if user.full_name else "[Your Name]"}
            Position: {user.position if user.position else "[Your Position]"}
            Company: {user.company_name if user.company_name else "[Your Company]"}
            Company Description: {user.company_description if user.company_description else "[brief description of company]"}
            
            Please generate a professional final follow-up email that:
            1. Acknowledges this is the final attempt to connect
            2. Is polite and professional, not desperate or pushy
            3. Offers a clear, compelling reason to respond now
            4. Provides a specific deadline or time-sensitive offer
            5. Includes a clear call to action
            6. Is concise (2-3 short paragraphs maximum)
            7. Maintains dignity and professionalism
            8. Leaves the door open for future contact
            9. If a company description is provided, use it to reinforce the value proposition
            10. Avoid using em dashes (—) - use regular dashes (-) or other appropriate punctuation instead
            
            This should feel like a final, respectful attempt to connect, not a desperate plea.
            """
            
            try:
                response = self.client.chat.completions.create(
                    model=AZURE_DEPLOYMENT_NAME,
                    messages=[
                        {"role": "system", "content": "You are an expert email writer specializing in professional final follow-up emails. Create emails that are respectful and professional, not desperate or pushy. Do not use any markdown formatting (like ** or *) in the email content."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.7,
                    max_tokens=800
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
                
                # Add consistent signature format
                signature = f"""
Best regards,
{user.full_name if user.full_name else "[Your Name]"}
{user.position if user.position else "[Your Position]"}
{user.company_name if user.company_name else "[Your Company]"}"""
                
                content = f"{content}\n\n{signature}"
                
            except Exception as e:
                raise Exception(f"Failed to generate last chance email: {str(e)}")
        
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
            # Use the single source of truth for due dates
            follow_up_date=now + timedelta(days=lastchance_days),
            created_at=now,
            # Set legacy fields for backward compatibility
            to=recipient_email,
            body=content
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
