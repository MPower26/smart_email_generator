from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

# Load environment variables from db.env
load_dotenv('db.env')

# Get database connection details
DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_DRIVER = os.getenv("DB_DRIVER")
DB_TRUST_SERVER_CERTIFICATE = os.getenv("DB_TRUST_SERVER_CERTIFICATE", "no")
DB_ENCRYPT = os.getenv("DB_ENCRYPT", "yes")
DB_TIMEOUT = os.getenv("DB_TIMEOUT", "30")

# Construct the database URL
DATABASE_URL = (
    f"mssql+pyodbc://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:1433/{DB_NAME}"
    f"?driver={DB_DRIVER}"
    f"&TrustServerCertificate={DB_TRUST_SERVER_CERTIFICATE}"
    f"&Encrypt={DB_ENCRYPT}"
    f"&Connection+Timeout={DB_TIMEOUT}"
)

# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 