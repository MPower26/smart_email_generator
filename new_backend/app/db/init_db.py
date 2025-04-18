from sqlalchemy import inspect, text
from ..db.database import engine, Base, SessionLocal
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
    
    # Check if generated_emails exists and has the stage column
    if 'generated_emails' in existing_tables_after:
        columns = {column['name'] for column in inspector.get_columns('generated_emails')}
        
        # Create a session to execute custom SQL
        db = SessionLocal()
        try:
            # Add stage column if it doesn't exist
            if 'stage' not in columns:
                print("Adding stage column to generated_emails table...")
                db.execute(text("ALTER TABLE generated_emails ADD COLUMN stage VARCHAR(50) DEFAULT 'outreach'"))
                db.commit()
                print("✅ Added stage column to generated_emails table")
            
            # Check if any emails exist with NULL stage and update them
            result = db.execute(text("SELECT COUNT(*) FROM generated_emails WHERE stage IS NULL"))
            null_stage_count = result.scalar()
            
            if null_stage_count > 0:
                print(f"Updating {null_stage_count} emails with NULL stage...")
                # Set default stage based on follow_up dates
                db.execute(text("""
                    UPDATE generated_emails 
                    SET stage = CASE
                        WHEN final_follow_up_date IS NOT NULL THEN 'lastchance'
                        WHEN follow_up_date IS NOT NULL THEN 'followup'
                        ELSE 'outreach'
                    END
                    WHERE stage IS NULL
                """))
                db.commit()
                print("✅ Updated emails with NULL stage")
        except Exception as e:
            db.rollback()
            print(f"❌ Error updating database: {str(e)}")
        finally:
            db.close()
    
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