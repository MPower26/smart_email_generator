#!/bin/bash

echo "Starting application setup..."

# Set environment variables
export PYTHONUNBUFFERED=1
export PORT=${PORT:-8000}

# Print diagnostic information
echo "Current directory: $(pwd)"
echo "Directory contents: $(ls -la)"

# Install Python dependencies
echo "Installing dependencies..."
python -m pip install --upgrade pip
pip install -r requirements.txt

# Start the FastAPI application with uvicorn
echo "Starting FastAPI application..."
uvicorn app.main:app --host 0.0.0.0 --port $PORT