# Smart Email Generator Backend

A FastAPI-based backend for the Smart Email Generator application.

## Project Structure

```
new_backend/
├── app/
│   ├── api/          # API endpoints
│   ├── core/         # Core functionality
│   ├── db/           # Database configuration
│   ├── models/       # SQLAlchemy models
│   ├── services/     # Business logic
│   └── utils/        # Utility functions
├── db.env            # Database configuration (DO NOT COMMIT)
└── requirements.txt  # Python dependencies
```

## Security Notes

1. **Database Credentials**:
   - Never commit `db.env` to version control
   - Use environment variables in production
   - Rotate credentials regularly
   - Use Azure Key Vault for production secrets

2. **Environment Setup**:
   - Copy `db.env.example` to `db.env`
   - Update credentials in `db.env`
   - Add `db.env` to `.gitignore`

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure database:
- Copy `db.env.example` to `db.env`
- Update the database credentials in `db.env`
- Never commit `db.env` to version control

3. Initialize database:
```bash
python -m app.db.init_db
```

4. Run the development server:
```bash
uvicorn app.main:app --reload
```

## Features

- User authentication with email verification
- Email template management
- Smart email generation
- Follow-up email scheduling
- User friendship system for shared databases 