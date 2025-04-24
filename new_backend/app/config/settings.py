import os
from pathlib import Path
from dotenv import load_dotenv

# Determine if we're running in production
IS_PRODUCTION = os.getenv('AZURE_WEBSITE_NAME') is not None

# Load local environment variables if not in production
if not IS_PRODUCTION:
    env_path = Path(__file__).parent.parent.parent / 'db.env'
    if env_path.exists():
        load_dotenv(env_path)

# Email Configuration
EMAIL_CONFIG = {
    'sender_email': os.getenv('SENDER_EMAIL', 'tom@wesiagency.com'),
    'from_name': os.getenv('SENDGRID_FROM_NAME', 'Smart Email Generator'),
    'api_key': os.getenv('SENDGRID_API_KEY'),
    'template_id': os.getenv('SENDGRID_TEMPLATE_ID', '').split('#')[0].strip()
}

# Database Configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST'),
    'database': os.getenv('DB_NAME'),
    'username': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'driver': os.getenv('DB_DRIVER', 'ODBC Driver 18 for SQL Server'),
    'trust_server_certificate': os.getenv('DB_TRUST_SERVER_CERTIFICATE', 'yes').lower() == 'yes',
    'encrypt': os.getenv('DB_ENCRYPT', 'yes').lower() == 'yes',
    'timeout': int(os.getenv('DB_TIMEOUT', '30'))
}

# Validation
def validate_config():
    """Validate required configuration settings."""
    missing_vars = []
    
    # Check email configuration
    if not EMAIL_CONFIG['api_key']:
        missing_vars.append('SENDGRID_API_KEY')
    if not EMAIL_CONFIG['sender_email']:
        missing_vars.append('SENDER_EMAIL')
        
    # Check database configuration
    required_db_vars = ['host', 'database', 'username', 'password']
    for var in required_db_vars:
        if not DB_CONFIG[var]:
            missing_vars.append(f'DB_{var.upper()}')
    
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

# Validate configuration on import
validate_config() 