# AI Personalized Email Generator

A tool that generates highly personalized outreach emails using Azure OpenAI API by analyzing CSV contact data and extracting information from company websites.

## Features

- CSV contact data analysis
- Website information extraction via simulated web scraping
- Personalized email generation using Azure OpenAI
- Tracking of processed emails to avoid duplicates
- Command-line interface for easy usage

## Requirements

- Python 3.8 or higher
- Required Python libraries (see `requirements.txt`)
- Valid Azure OpenAI API key
- Configured Azure OpenAI endpoint

## Installation

1. Clone this repository
2. Install required dependencies:

```bash
pip install -r requirements.txt
```

## Configuration

Modify the variables in `ai_email_generator.py` according to your needs:

```python
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY = "your_api_key"
AZURE_OPENAI_ENDPOINT = "your_endpoint"
AZURE_DEPLOYMENT_NAME = "your_model_name"

# Sender Information
SENDER_NAME = "Your Name"
SENDER_COMPANY = "Your Company"
SENDER_POSITION = "Your Position"
SENDER_CONTACT = "your@email.com"
```

## Usage

```bash
# Basic usage with default CSV file
python ai_email_generator.py

# Specify a custom CSV file
python ai_email_generator.py --csv your_file.csv

# Display a preview of each generated email
python ai_email_generator.py --preview

# Display only campaign statistics
python ai_email_generator.py --stats
```

## CSV Format

The script is configured to use a CSV file exported from Apollo with the following columns (minimum required):

- First Name
- Last Name
- Title
- Company
- Email
- Industry
- Keywords
- Website
- SEO Description
- Technologies
- Person Linkedin Url
- Company Linkedin Url
- # Employees
- Annual Revenue

## Web Scraping Functionality

The `WebScraper` class simulates extracting information from company websites. In a complete implementation, it would use BeautifulSoup or Scrapy to extract relevant information such as:

- Company description
- Key products and services
- Company values
- Recent news

This information is then used to further personalize the generated emails.

## Future Improvements

- Actual web scraping implementation with BeautifulSoup or Scrapy
- Graphical user interface
- Integration with email sending tools (SMTP, email marketing services)
- Email effectiveness and sentiment analysis
- Enhanced personalization with additional data sources (LinkedIn, Twitter, etc.)
- CRM integration for response tracking 