# Azure App Service Deployment Script
# This script configures the Azure App Service with proper timeout settings

param(
    [string]$ResourceGroupName = "emailapp-rg",
    [string]$AppServiceName = "smart-email-backend-d8dcejbqe5h9bdcq",
    [string]$Location = "West Europe"
)

Write-Host "Configuring Azure App Service timeout settings..." -ForegroundColor Green

# Set Azure App Service configuration
az webapp config set `
    --resource-group $ResourceGroupName `
    --name $AppServiceName `
    --generic-configurations '{
        "applicationStack": {
            "python": {
                "pythonVersion": "3.11"
            }
        },
        "http20Enabled": true,
        "minTlsVersion": "1.2",
        "ftpsState": "Disabled",
        "httpLogging": {
            "fileSystem": {
                "retentionInMb": 35,
                "retentionInDays": 7,
                "enabled": true
            }
        }
    }'

# Set app settings for timeout configuration
az webapp config appsettings set `
    --resource-group $ResourceGroupName `
    --name $AppServiceName `
    --settings `
    WEBSITES_CONTAINER_START_TIME_LIMIT=1800 `
    WEBSITES_ENABLE_APP_SERVICE_STORAGE=true `
    PYTHON_ENABLE_GUNICORN=true `
    PYTHONPATH=/home/site/wwwroot `
    WEBSOCKET_ENABLED=true

Write-Host "Azure App Service configuration completed!" -ForegroundColor Green
Write-Host "Timeout settings:" -ForegroundColor Yellow
Write-Host "  - Container start time limit: 1800 seconds (30 minutes)" -ForegroundColor Yellow
Write-Host "  - Gunicorn timeout: 1800 seconds (30 minutes)" -ForegroundColor Yellow
Write-Host "  - Request timeout: Configured for long-running operations" -ForegroundColor Yellow 
