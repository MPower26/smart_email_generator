# Quick Deploy DKIM Fix
Write-Host "🚀 Quick Deploy DKIM Fix..." -ForegroundColor Green

# Set environment variables
$env:AZURE_WEBAPP_NAME = "herm4s-backend"
$env:AZURE_RESOURCE_GROUP = "herm4s-rg"

# Navigate to backend directory
Set-Location "new_backend"

# Create ZIP file
Write-Host "📦 Creating backend ZIP..." -ForegroundColor Yellow
if (Test-Path "backend.zip") {
    Remove-Item "backend.zip" -Force
}

# Add only the modified service file
Compress-Archive -Path "app\services\domain_auth_service.py" -DestinationPath "backend.zip" -Force

# Add other necessary files
Compress-Archive -Path "app" -DestinationPath "backend.zip" -Update
Compress-Archive -Path "requirements.txt" -DestinationPath "backend.zip" -Update
Compress-Archive -Path "startup.sh" -DestinationPath "backend.zip" -Update
Compress-Archive -Path "gunicorn.conf.py" -DestinationPath "backend.zip" -Update
Compress-Archive -Path "web.config" -DestinationPath "backend.zip" -Update

# Deploy to Azure
Write-Host "☁️ Deploying to Azure..." -ForegroundColor Yellow
az webapp deployment source config-zip --resource-group $env:AZURE_RESOURCE_GROUP --name $env:AZURE_WEBAPP_NAME --src backend.zip

# Restart the web app
Write-Host "🔄 Restarting web app..." -ForegroundColor Yellow
az webapp restart --resource-group $env:AZURE_RESOURCE_GROUP --name $env:AZURE_WEBAPP_NAME

Write-Host "✅ Quick deploy completed!" -ForegroundColor Green
Write-Host "🌐 Check logs: az webapp log tail --resource-group $env:AZURE_RESOURCE_GROUP --name $env:AZURE_WEBAPP_NAME" -ForegroundColor Cyan 
