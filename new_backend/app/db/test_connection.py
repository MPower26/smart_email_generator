from sqlalchemy import text
from dotenv import load_dotenv
from database import engine
import sys

def test_connection():
    try:
        # Try to connect and execute a simple query
        with engine.connect() as connection:
            result = connection.execute(text("SELECT @@version"))
            version = result.scalar()
            print("✅ Successfully connected to the database!")
            print(f"SQL Server version: {version}")
            
            # Test if we can access our tables
            result = connection.execute(text("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'"))
            tables = [row[0] for row in result]
            print("\nAvailable tables:")
            for table in tables:
                print(f"- {table}")
                
    except Exception as e:
        print("❌ Failed to connect to the database!")
        print(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    # Load environment variables
    load_dotenv('db.env')
    
    # Run the test
    test_connection() 