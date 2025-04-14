from sqlalchemy import inspect
from ..db.database import engine, Base
from ..models.models import User, EmailTemplate, GeneratedEmail, VerificationCode

def init_db():
    """Initialize the database with all required tables"""
    # Check if tables exist before creation
    inspector = inspect(engine)
    existing_tables_before = set(inspector.get_table_names())
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    # Check tables again after creation
    existing_tables_after = set(inspector.get_table_names())
    
    # Get list of new tables that were actually created
    new_tables = list(existing_tables_after - existing_tables_before)
    
    # Print status with more details
    print("\nDatabase Initialization Status:")
    print("==============================")
    
    if new_tables:
        print("✅ Created new tables:")
        for table in new_tables:
            print(f"  - {table}")
    
    print("\nExisting tables:")
    for table in existing_tables_after:
        print(f"  - {table}")
        # Show columns for each table
        columns = inspector.get_columns(table)
        for column in columns:
            print(f"    • {column['name']} ({column['type']})")
    
    print("\nVerification system tables:")
    verification_tables = ['users', 'verification_codes']
    for table in verification_tables:
        if table in existing_tables_after:
            print(f"✅ {table} table is ready")
        else:
            print(f"❌ {table} table is missing")
    
    print("\nEmail system tables:")
    email_tables = ['email_templates', 'generated_emails']
    for table in email_tables:
        if table in existing_tables_after:
            print(f"✅ {table} table is ready")
        else:
            print(f"❌ {table} table is missing")

if __name__ == "__main__":
    print("Initializing database...")
    init_db()
    print("\nDatabase initialization complete!") 