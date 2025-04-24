#!/bin/bash

echo "Starting application setup..."

# Set environment variables
export PYTHONUNBUFFERED=1
export PORT=${PORT:-8000}

# Print diagnostic information
echo "Current directory: $(pwd)"
echo "Directory contents: $(ls -la)"

# Create and activate virtual environment in the home directory (which is writable)
echo "Setting up Python environment..."
VENV_PATH="/home/venv"
python -m venv $VENV_PATH
source $VENV_PATH/bin/activate

# Install dependencies
echo "Installing dependencies..."
python -m pip install --upgrade pip
pip install -r requirements.txt

# Start the FastAPI application with gunicorn
echo "Starting FastAPI application with Gunicorn..."
gunicorn app.main:app \
    --bind=0.0.0.0:$PORT \
    --workers=4 \
    --worker-class=uvicorn.workers.UvicornWorker \
    --timeout=120 \
    --access-logfile=- \
    --error-logfile=- \
    --log-level=info