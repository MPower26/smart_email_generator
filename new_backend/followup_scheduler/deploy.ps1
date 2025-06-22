# Azure Function Deployment Script
# This script deploys the followup scheduler function to Azure

param(
    [string]$FunctionAppName = "smart-email-functions",
    [string]$ResourceGroup = "smart-email-rg",
    [string]$Location = "West Europe"
)

Write-Host "Deploying followup scheduler function to Azure..." -ForegroundColor Green

# Check if Azure CLI is installed
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Error "Azure CLI is not installed. Please install it from https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
}

# Check if logged in
$account = az account show 2>$null
if (-not $account) {
    Write-Host "Please log in to Azure..." -ForegroundColor Yellow
    az login
}

# Create resource group if it doesn't exist
Write-Host "Creating resource group if it doesn't exist..." -ForegroundColor Yellow
az group create --name $ResourceGroup --location $Location

# Create function app if it doesn't exist
Write-Host "Creating function app if it doesn't exist..." -ForegroundColor Yellow
az functionapp create --name $FunctionAppName --resource-group $ResourceGroup --consumption-plan-location $Location --runtime python --runtime-version 3.11 --functions-version 4 --os-type Linux

# Deploy the function
Write-Host "Deploying function..." -ForegroundColor Yellow
az functionapp deployment source config-zip --resource-group $ResourceGroup --name $FunctionAppName --src followup_scheduler.zip

Write-Host "Deployment completed!" -ForegroundColor Green
Write-Host "Function App URL: https://$FunctionAppName.azurewebsites.net" -ForegroundColor Cyan 
