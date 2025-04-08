#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
AI Email Generator
-----------------
A tool that generates personalized outreach emails using Azure OpenAI API
by analyzing CSV contact data and extracting information from company websites.
"""

import csv
import json
import os
import time
import random
import argparse
import requests
from urllib.parse import urlparse
from openai import AzureOpenAI

# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY = "65f3a3cbcc54451d9ae6b8740303c648"
AZURE_OPENAI_ENDPOINT = "https://francecentral.api.cognitive.microsoft.com/"
AZURE_DEPLOYMENT_NAME = "Avocat"

# Sender Information
SENDER_NAME = "Tom"
SENDER_COMPANY = "Wesi Agency"
SENDER_POSITION = "AI Solutions Consultant"
SENDER_CONTACT = "tom@wesiagency.com"

# Files for storing processed emails and output
PROCESSED_EMAILS_FILE = "processed_emails.json"
OUTPUT_EMAILS_FILE = "personalized_emails.json"

class WebScraper:
    """
    Class for extracting information from company websites.
    This is a simulation of web scraping functionality.
    In a real implementation, it would use libraries like BeautifulSoup or Scrapy.
    """
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        })
        # Cache to store already extracted data
        self.cache = {}
        self._load_cache()
    
    def _load_cache(self):
        """Load cache from file if available"""
        try:
            with open('webscraper_cache.json', 'r') as f:
                self.cache = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            self.cache = {}
    
    def _save_cache(self):
        """Save cache to file"""
        with open('webscraper_cache.json', 'w') as f:
            json.dump(self.cache, f, indent=2)
    
    def extract_info(self, url):
        """
        Extract relevant information from a company website
        
        Args:
            url (str): Website URL
            
        Returns:
            dict: Extracted information
        """
        # Check if URL is in cache
        if url in self.cache:
            print(f"Using cache for {url}")
            return self.cache[url]
        
        try:
            print(f"Extracting information from {url}")
            
            # In a real implementation, we would make an HTTP request and use BeautifulSoup
            # response = self.session.get(url, timeout=10)
            # soup = BeautifulSoup(response.text, 'html.parser')
            
            # Simulate data extraction delay
            time.sleep(random.uniform(1, 2))
            
            # Create simulated data
            info = self._simulate_extraction(url)
            
            # Store in cache
            self.cache[url] = info
            self._save_cache()
            
            return info
            
        except Exception as e:
            print(f"Error extracting information from {url}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "data": {}
            }
    
    def _simulate_extraction(self, url):
        """
        Simulate website data extraction
        
        In a real implementation, this method would be replaced with 
        actual HTML analysis using BeautifulSoup or Scrapy
        """
        domain = url.split('://')[-1].split('/')[0]
        
        # Simulate different website types based on domain
        if 'xsensor' in domain:
            return {
                "success": True,
                "data": {
                    "about": "XSENSOR Technology Corporation is a leader in intelligent pressure sensor technology, providing solutions to improve comfort, safety, and performance across various sectors.",
                    "key_products": ["Pressure mapping systems", "Sensors for medical sector", "Solutions for automotive industry"],
                    "company_values": ["Innovation", "Quality", "Customer satisfaction"],
                    "recent_news": "XSENSOR recently launched a new generation of high-resolution sensors for medical applications."
                }
            }
        elif 'fraisa' in domain:
            return {
                "success": True,
                "data": {
                    "about": "Fraisa is a Swiss manufacturer of high-quality precision tools for the manufacturing industry, specializing in milling cutters, drills, and threading tools.",
                    "key_products": ["Milling tools", "Drilling tools", "Threading tools", "Tool reconditioning services"],
                    "company_values": ["Precision", "Sustainability", "Innovation", "Swiss excellence"],
                    "recent_news": "Fraisa introduced a new line of tools optimized for machining composite materials."
                }
            }
        elif 'entera' in domain:
            return {
                "success": True,
                "data": {
                    "about": "Entera is a SaaS and Services platform for Single Family Investors, enabling them to buy, sell and operate their real estate investments seamlessly.",
                    "key_products": ["Real estate investment platform", "Property analysis tools", "Transaction management services"],
                    "company_values": ["Technological innovation", "Transparency", "Efficiency"],
                    "recent_news": "Entera recently secured $32 million in Series A funding to expand its real estate investment platform."
                }
            }
        else:
            # Generic data for other domains
            return {
                "success": True,
                "data": {
                    "about": f"Company with website {domain}",
                    "key_products": ["Product 1", "Product 2", "Service 1"],
                    "company_values": ["Innovation", "Quality", "Customer service"],
                    "recent_news": "No recent news available."
                }
            }

class EmailPersonalizer:
    """
    Main class for generating personalized emails using Azure OpenAI API
    and website information extraction
    """
    
    def __init__(self):
        # Initialize Azure OpenAI client
        self.client = AzureOpenAI(
            api_key=AZURE_OPENAI_API_KEY,
            api_version="2023-12-01-preview",
            azure_endpoint=AZURE_OPENAI_ENDPOINT
        )
        
        # Initialize web scraper
        self.scraper = WebScraper()
        
        # Load previously processed emails
        self.processed_emails = self._load_processed_emails()
        self.generated_emails = []
    
    def _load_processed_emails(self):
        """Load previously processed emails from JSON file"""
        if os.path.exists(PROCESSED_EMAILS_FILE):
            with open(PROCESSED_EMAILS_FILE, 'r') as f:
                return json.load(f)
        return []
    
    def _save_processed_email(self, email):
        """Add an email to the list of processed emails"""
        self.processed_emails.append(email)
        with open(PROCESSED_EMAILS_FILE, 'w') as f:
            json.dump(self.processed_emails, f, indent=2)
    
    def _save_generated_emails(self):
        """Save all generated emails to a JSON file"""
        with open(OUTPUT_EMAILS_FILE, 'w') as f:
            json.dump(self.generated_emails, f, indent=2, ensure_ascii=False)
        print(f"Personalized emails saved to {OUTPUT_EMAILS_FILE}")
    
    def extract_website_info(self, website_url):
        """Extract relevant information from a company website using scraper"""
        if not website_url or website_url.strip() == "":
            return "Information not available"
        
        # Verify URL is valid
        parsed_url = urlparse(website_url)
        if not parsed_url.scheme or not parsed_url.netloc:
            return "Invalid URL"
        
        # Use scraper to extract information
        info = self.scraper.extract_info(website_url)
        
        if not info["success"]:
            return f"Failed to extract information: {info.get('error', 'Unknown error')}"
        
        # Format extracted information
        data = info["data"]
        formatted_info = f"""
        About: {data.get('about', 'Not available')}
        
        Key Products/Services: {', '.join(data.get('key_products', ['Not available']))}
        
        Company Values: {', '.join(data.get('company_values', ['Not available']))}
        
        Recent News: {data.get('recent_news', 'Not available')}
        """
        
        return formatted_info
    
    def generate_personalized_email(self, contact_data):
        """Generate a personalized email using Azure OpenAI API"""
        
        # Check if email has already been processed
        if contact_data["Email"] in self.processed_emails:
            print(f"Email already processed: {contact_data['Email']}")
            return None
        
        # Extract information from company website
        website_info = self.extract_website_info(contact_data.get("Website", ""))
        
        # Build context for OpenAI API
        prompt = f"""
        Create a personalized outreach email in English for:
        
        First Name: {contact_data.get('First Name', '')}
        Last Name: {contact_data.get('Last Name', '')}
        Title: {contact_data.get('Title', '')}
        Company: {contact_data.get('Company', '')}
        Industry: {contact_data.get('Industry', '')}
        Keywords: {contact_data.get('Keywords', '')}
        SEO Description: {contact_data.get('SEO Description', '')}
        Technologies: {contact_data.get('Technologies', '')}
        Personal LinkedIn: {contact_data.get('Person Linkedin Url', '')}
        Company LinkedIn: {contact_data.get('Company Linkedin Url', '')}
        Website: {contact_data.get('Website', '')}
        Number of Employees: {contact_data.get('# Employees', '')}
        Annual Revenue: {contact_data.get('Annual Revenue', '')}
        
        Additional information from website: {website_info}
        
        Use the following template and personalize it with specific and relevant information:
        
        Hi [First Name],

        I understand that [Prospect's Company] is continually seeking innovative solutions to enhance operations and drive growth. At [Your Company], we specialize in crafting tailored AI solutions designed to address such objectives.

        [Insert 1-2 personalized sentences based on available information, such as their industry, technologies, potential challenges, etc.]

        We pride ourselves on being selective with our client partnerships, enabling swift and efficient collaborations. Our access to exclusive, cutting-edge AI technologies ensures that our solutions are both innovative and effective.

        To demonstrate our commitment to value, we offer a no-cost prototype tailored to your specific needs, requiring only a brief discussion to understand your challenges.

        Would you be open to a 15-minute call next week to explore this opportunity?

        Best regards,

        [Your Name]
        [Your Position]
        [Your Contact Information]
        
        The email must be entirely in English, highly personalized, professional, and concise. Focus on the value we can bring to their specific business and industry. Use specific information from the website to show you've done research on the company.
        """
        
        try:
            response = self.client.chat.completions.create(
                model=AZURE_DEPLOYMENT_NAME,
                messages=[
                    {"role": "system", "content": "You are an expert in marketing and professional email writing in English. All your responses must be in English."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=800
            )
            
            email_content = response.choices[0].message.content.strip()
            
            # Replace remaining placeholders in the email
            email_content = email_content.replace("[Your Name]", SENDER_NAME)
            email_content = email_content.replace("[Your Position]", SENDER_POSITION)
            email_content = email_content.replace("[Your Contact Information]", SENDER_CONTACT)
            email_content = email_content.replace("[Your Company]", SENDER_COMPANY)
            
            # Generate a customized subject based on industry
            industry = contact_data.get('Industry', '')
            if industry:
                subject = f"AI Solutions for {industry} - {contact_data.get('Company', 'your business')}"
            else:
                subject = f"AI Solutions for {contact_data.get('Company', 'your business')}"
            
            email_obj = {
                "to": contact_data["Email"],
                "subject": subject,
                "content": email_content
            }
            
            # Add email to list of generated emails
            self.generated_emails.append(email_obj)
            
            # Mark email as processed
            self._save_processed_email(contact_data["Email"])
            
            return email_obj
            
        except Exception as e:
            print(f"Error generating email: {e}")
            return None
    
    def process_csv(self, csv_file):
        """Process the CSV file and generate personalized emails for each contact"""
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    print(f"Processing contact: {row.get('First Name', '')} {row.get('Last Name', '')}")
                    email = self.generate_personalized_email(row)
                    if email:
                        print(f"Email generated for: {row.get('Email', '')}")
                    
                # Save all generated emails
                self._save_generated_emails()
                
                print(f"Processing complete. {len(self.generated_emails)} emails generated.")
                
        except Exception as e:
            print(f"Error processing CSV file: {e}")

# Command line interface functions
def display_banner():
    """Display a banner for the script"""
    print("""
    ╔════════════════════════════════════════════════════════════╗
    ║                                                            ║
    ║  AI Personalized Email Generator                           ║
    ║  Wesi Agency - AI Solutions                                ║
    ║                                                            ║
    ╚════════════════════════════════════════════════════════════╝
    """)

def display_stats(generated_emails_file, processed_emails_file):
    """Display campaign statistics"""
    generated_count = 0
    processed_count = 0
    
    if os.path.exists(generated_emails_file):
        with open(generated_emails_file, 'r') as f:
            try:
                data = json.load(f)
                generated_count = len(data)
            except json.JSONDecodeError:
                pass
    
    if os.path.exists(processed_emails_file):
        with open(processed_emails_file, 'r') as f:
            try:
                data = json.load(f)
                processed_count = len(data)
            except json.JSONDecodeError:
                pass
    
    print("\n------- Campaign Statistics -------")
    print(f"Emails generated: {generated_count}")
    print(f"Total emails processed: {processed_count}")
    print("-----------------------------------\n")

def preview_email(email_data):
    """Display a preview of a generated email"""
    print("\n---------- EMAIL PREVIEW ----------")
    print(f"To: {email_data['to']}")
    print(f"Subject: {email_data['subject']}")
    print("\nContent:")
    print(email_data['content'])
    print("-----------------------------------\n")

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="AI Personalized Email Generator")
    parser.add_argument('--csv', type=str, default="apollo-contacts-export.csv", 
                        help="Path to CSV file containing contact data")
    parser.add_argument('--preview', action='store_true', 
                        help="Display a preview of each generated email")
    parser.add_argument('--stats', action='store_true', 
                        help="Display only statistics")
    
    args = parser.parse_args()
    
    display_banner()
    
    if args.stats:
        display_stats(OUTPUT_EMAILS_FILE, PROCESSED_EMAILS_FILE)
        return
    
    if not os.path.exists(args.csv):
        print(f"Error: CSV file '{args.csv}' does not exist.")
        return
    
    # Initialize email personalizer
    personalizer = EmailPersonalizer()
    
    # Process CSV and generate emails
    print(f"Processing CSV file: {args.csv}")
    
    # If preview option is enabled, temporarily modify the method
    if args.preview:
        # Save original method
        original_method = personalizer.generate_personalized_email
        
        # Create a modified method that displays a preview
        def modified_method(contact_data):
            email_data = original_method(contact_data)
            if email_data:
                preview_email(email_data)
            return email_data
        
        # Temporarily replace the method
        personalizer.generate_personalized_email = modified_method
    
    # Execute processing
    personalizer.process_csv(args.csv)
    
    # Display statistics
    display_stats(OUTPUT_EMAILS_FILE, PROCESSED_EMAILS_FILE)
    
    print(f"To view generated emails, check the '{OUTPUT_EMAILS_FILE}' file")

if __name__ == "__main__":
    main() 