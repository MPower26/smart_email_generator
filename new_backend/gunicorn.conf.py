# Gunicorn configuration file
import multiprocessing
import os

# Server socket
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
backlog = 2048

# Worker processes
workers = 2
worker_class = 'uvicorn.workers.UvicornWorker'
worker_connections = 1000
timeout = 1800  # 30 minutes
keepalive = 5
max_requests = 1000
max_requests_jitter = 100

# Logging
accesslog = '-'
errorlog = '-'
loglevel = 'info' 
