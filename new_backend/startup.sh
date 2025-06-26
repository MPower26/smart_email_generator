#!/bin/bash

echo "Starting application setup..."

# Set environment variables
export PYTHONUNBUFFERED=1
export PORT=${PORT:-8000}
export PYTHONPATH=/home/site/wwwroot

# Configure Azure App Service timeout settings
export WEBSITES_CONTAINER_START_TIME_LIMIT=1800  # 30 minutes
export WEBSITES_ENABLE_APP_SERVICE_STORAGE=true

# Print diagnostic information
echo "Current directory: $(pwd)"
echo "Directory contents: $(ls -la)"
echo "Python version: $(python --version)"
echo "Pip version: $(pip --version)"
echo "Installed packages:"
pip list

# Verify dependencies are installed
if ! python -c "import sendgrid" 2>/dev/null; then
    echo "SendGrid not found, installing dependencies..."
    pip install -r requirements.txt
fi

# Verify WebSocket dependencies are installed
if ! python -c "import websockets" 2>/dev/null; then
    echo "WebSocket dependencies not found, installing..."
    pip install websockets wsproto
fi

# Start the FastAPI application with gunicorn
echo "Starting FastAPI application with Gunicorn..."
exec gunicorn --bind=0.0.0.0:$PORT \
    --workers=2 \
    --worker-class=uvicorn.workers.UvicornWorker \
    --timeout=1800 \
    --keep-alive=5 \
    --max-requests=1000 \
    --max-requests-jitter=100 \
    --access-logfile=- \
    --error-logfile=- \
    --log-level=debug \
    --chdir=/home/site/wwwroot \
    app.main:app
