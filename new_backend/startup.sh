#!/bin/bash

echo "Starting application setup..."

# Set environment variables
export PYTHONUNBUFFERED=1
export PORT=${PORT:-8000}

# Print diagnostic information
echo "Current directory: $(pwd)"
echo "Directory contents: $(ls -la)"
echo "Python version: $(python --version)"
echo "Pip version: $(pip --version)"

# Start the FastAPI application with gunicorn
echo "Starting FastAPI application with Gunicorn..."
cd /home/site/wwwroot && \
gunicorn --bind=0.0.0.0:$PORT \
    --workers=4 \
    --worker-class=uvicorn.workers.UvicornWorker \
    --timeout=120 \
    --access-logfile=- \
    --error-logfile=- \
    --log-level=debug \
    app.main:app