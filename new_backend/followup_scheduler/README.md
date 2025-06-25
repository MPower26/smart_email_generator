# Followup Scheduler Azure Function

This Azure Function replaces the APScheduler that was previously running in the main FastAPI application. It runs every hour to check for emails that are due for follow-up and sends notification emails to users.

## Features

- Runs every hour via Azure Functions timer trigger
- Checks for emails with `followup_due_at` and `lastchance_due_at` timestamps
- Sends notification emails via SendGrid
- Uses the same database as the main application

## Deployment

### Option 1: GitHub Actions (Recommended)

1. Add the following secret to your GitHub repository:
   - `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`: The publish profile from your Azure Function App

2. Push changes to the `followup_scheduler` folder - the workflow will automatically deploy

### Option 2: Manual Deployment

1. Create an Azure Function App:
   ```bash
   az functionapp create --name smart-email-functions --resource-group emailapp-rg --consumption-plan-location West Europe --runtime python --runtime-version 3.11 --functions-version 4 --os-type Linux
   ```

2. Deploy the function:
   ```bash
   az functionapp deployment source config-zip --resource-group emailapp-rg --name smart-email-functions --src followup_scheduler.zip
   ```

## Configuration

Set the following environment variables in your Azure Function App:

### Database Configuration (required)
- `DB_HOST`: Your database server hostname
- `DB_NAME`: Your database name
- `DB_USER`: Your database username
- `DB_PASSWORD`: Your database password
- `DB_DRIVER`: ODBC driver (default: "ODBC Driver 18 for SQL Server")
- `DB_TRUST_SERVER_CERTIFICATE`: Trust server certificate (default: "yes")
- `DB_ENCRYPT`: Enable encryption (default: "yes")
- `DB_TIMEOUT`: Connection timeout in seconds (default: "30")

### Email Configuration (required)
- `SENDGRID_API_KEY`: Your SendGrid API key
- `SENDGRID_FROM_EMAIL`: The email address to send notifications from (default: noreply@smartemailgenerator.com)

### Application Configuration (optional)
- `APP_URL`: Your frontend application URL (default: https://jolly-bush-0bae83703.6.azurestaticapps.net)

## Schedule

The function runs every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.) using the cron expression: `0 0 * * * *`

## Monitoring

You can monitor the function execution in the Azure Portal:
1. Go to your Function App
2. Click on "Functions" → "followup_scheduler"
3. Click on "Monitor" to see execution logs

## Testing

To test the function locally:

1. Install Azure Functions Core Tools
2. Run: `func start`
3. The function will be available at `http://localhost:7071/api/followup_scheduler`

## Troubleshooting

- Check the function logs in Azure Portal for any errors
- Verify that all environment variables are set correctly
- Ensure the database connection string is accessible from Azure Functions
- Check that SendGrid API key has permission to send emails

---
*Last updated: 2024-06-22 - Ready for GitHub Actions deployment* 
