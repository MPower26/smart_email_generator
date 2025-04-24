# Create deployment directory if it doesn't exist
New-Item -ItemType Directory -Force -Path "deploy"

# Copy necessary files and directories
Copy-Item -Path "app" -Destination "deploy" -Recurse -Force
Copy-Item -Path "alembic" -Destination "deploy" -Recurse -Force
Copy-Item -Path "requirements.txt" -Destination "deploy" -Force
Copy-Item -Path "startup.sh" -Destination "deploy" -Force
Copy-Item -Path "gunicorn.conf.py" -Destination "deploy" -Force
Copy-Item -Path "__init__.py" -Destination "deploy" -Force
Copy-Item -Path "db.env" -Destination "deploy" -Force

# Verify the deployment package
Write-Host "Deployment package created successfully!"
Get-ChildItem -Path "deploy" -Recurse 