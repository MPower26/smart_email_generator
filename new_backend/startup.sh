
# Set environment variables
export PYTHONUNBUFFERED=1
export WEBSITE_HOSTNAME=localhost:8000
export PORT=8000

# Change to the application directory
cd /home/site/wwwroot

# Install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# Start the application
gunicorn app.main:app --config gunicorn.conf.py