import os
from pathlib import Path
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)

# Determine if we're running in production
IS_PRODUCTION = os.getenv('AZURE_WEBSITE_NAME') is not None
logger.info(f"Running in {'Production' if IS_PRODUCTION else 'Development'} mode")

# Load local environment variables if not in production
if not IS_PRODUCTION:
    env_path = Path(__file__).parent.parent.parent / 'db.env'
    if env_path.exists():
        logger.info(f"Loading environment from {env_path}")
        load_dotenv(env_path)
    else:
        logger.warning(f"Environment file not found at {env_path}")
else:
    logger.info("Using environment variables from Azure App Service")

# Debug environment variables
logger.info("Email-related environment variables:")
logger.info(f"  SENDER_EMAIL: {'Set' if os.getenv('SENDER_EMAIL') else 'Not set'}")
logger.info(f"  SENDGRID_FROM_NAME: {'Set' if os.getenv('SENDGRID_FROM_NAME') else 'Not set'}")
logger.info(f"  SENDGRID_API_KEY: {'Set' if os.getenv('SENDGRID_API_KEY') else 'Not set'}")
logger.info(f"  SENDGRID_TEMPLATE_ID: {'Set' if os.getenv('SENDGRID_TEMPLATE_ID') else 'Not set'}")

# Email Configuration
EMAIL_CONFIG = {
    'sender_email': os.getenv('SENDER_EMAIL', 'tom@wesiagency.com'),
    'from_name': os.getenv('SENDGRID_FROM_NAME', 'Smart Email Generator'),
    'api_key': os.getenv('SENDGRID_API_KEY'),
    'template_id': os.getenv('SENDGRID_TEMPLATE_ID', '').split('#')[0].strip() if os.getenv('SENDGRID_TEMPLATE_ID') else ''
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
        logger.warning("SENDGRID_API_KEY is missing")
        missing_vars.append('SENDGRID_API_KEY')
    if not EMAIL_CONFIG['sender_email']:
        logger.warning("SENDER_EMAIL is missing")
        missing_vars.append('SENDER_EMAIL')
        
    # Check database configuration
    required_db_vars = ['host', 'database', 'username', 'password']
    for var in required_db_vars:
        if not DB_CONFIG[var]:
            var_name = f'DB_{var.upper()}'
            logger.warning(f"{var_name} is missing")
            missing_vars.append(var_name)
    
    if missing_vars:
        error_msg = f"Missing required environment variables: {', '.join(missing_vars)}"
        logger.error(error_msg)
        # In production, we don't want to crash the app, just log the error
        if not IS_PRODUCTION:
            raise ValueError(error_msg)
        return False
    return True

# Validate configuration on import
config_valid = validate_config()
if config_valid:
    logger.info("Configuration validation successful")
else:
    logger.warning("Configuration validation failed - app may not function correctly") 