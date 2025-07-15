# Deploy DKIM Fix to Azure
Write-Host "🚀 Deploying DKIM fixes to Azure..." -ForegroundColor Green

# Set environment variables
$env:AZURE_WEBAPP_NAME = "herm4s-backend"
$env:AZURE_RESOURCE_GROUP = "herm4s-rg"

# Navigate to backend directory
Set-Location "new_backend"

# Activate virtual environment
Write-Host "📦 Activating virtual environment..." -ForegroundColor Yellow
& "venv\Scripts\Activate.ps1"

# Install/update dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt

# Test the DKIM fix locally
Write-Host "🧪 Testing DKIM fix..." -ForegroundColor Yellow
python test_dkim_fix.py

# Deploy to Azure
Write-Host "☁️ Deploying to Azure..." -ForegroundColor Yellow
az webapp deployment source config-zip --resource-group $env:AZURE_RESOURCE_GROUP --name $env:AZURE_WEBAPP_NAME --src backend.zip

# Restart the web app
Write-Host "🔄 Restarting web app..." -ForegroundColor Yellow
az webapp restart --resource-group $env:AZURE_RESOURCE_GROUP --name $env:AZURE_WEBAPP_NAME

Write-Host "✅ DKIM fix deployment completed!" -ForegroundColor Green
Write-Host "🌐 Check the logs to verify the fix works:" -ForegroundColor Cyan
Write-Host "   az webapp log tail --resource-group $env:AZURE_RESOURCE_GROUP --name $env:AZURE_WEBAPP_NAME" -ForegroundColor Gray
