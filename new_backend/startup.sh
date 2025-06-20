#!/bin/bash

echo "Starting application setup..."

# Set environment variables
export PYTHONUNBUFFERED=1
export PORT=${PORT:-8000}
export PYTHONPATH=/home/site/wwwroot

# Print diagnostic information
echo "Current directory: $(pwd)"
echo "Directory contents: $(ls -la)"
echo "Python version: $(python --version)"
echo "Pip version: $(pip --version)"
echo "Installed packages:"
pip list

# Verify dependencies are installed
if ! python -c "import sendgrid, websockets, wsproto" 2>/dev/null; then
    echo "Dependencies not found, installing requirements..."
    pip install -r requirements.txt
fi

# Verify WebSocket dependencies specifically
echo "Verifying WebSocket dependencies..."
python -c "import websockets; print('websockets version:', websockets.__version__)"
python -c "import wsproto; print('wsproto version:', wsproto.__version__)"
python -c "import uvicorn; print('uvicorn version:', uvicorn.__version__)"

# Start the FastAPI application with gunicorn
echo "Starting FastAPI application with Gunicorn..."
exec gunicorn --bind=0.0.0.0:$PORT \
    --workers=4 \
    --worker-class=uvicorn.workers.UvicornWorker \
    --timeout=120 \
    --access-logfile=- \
    --error-logfile=- \
    --log-level=debug \
    --chdir=/home/site/wwwroot \
    app.main:app
