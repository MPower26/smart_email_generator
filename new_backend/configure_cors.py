#!/usr/bin/env python3
"""
Script to configure CORS settings for Azure Blob Storage
"""

import os
from azure.storage.blob import BlobServiceClient
from azure.storage.blob import CorsRule

def configure_cors():
    """Configure CORS settings for Azure Blob Storage"""
    
    # Get connection string from environment
    connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
    if not connection_string:
        print("❌ AZURE_STORAGE_CONNECTION_STRING environment variable not set")
        return False
    
    try:
        # Create blob service client
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        
        # Define CORS rules
        cors_rules = [
            CorsRule(
                allowed_origins=["https://jolly-bush-0bae83703.6.azurestaticapps.net", "http://localhost:3000"],
                allowed_methods=["GET", "HEAD", "OPTIONS"],
                allowed_headers=["*"],
                exposed_headers=["*"],
                max_age_in_seconds=86400  # 24 hours
            )
        ]
        
        # Get the service properties
        properties = blob_service_client.get_service_properties()
        
        # Update CORS settings
        properties['cors'] = cors_rules
        
        # Set the updated properties
        blob_service_client.set_service_properties(properties)
        
        print("✅ CORS settings configured successfully!")
        print("📋 Allowed origins:")
        for rule in cors_rules:
            for origin in rule.allowed_origins:
                print(f"   - {origin}")
        print("📋 Allowed methods:", cors_rules[0].allowed_methods)
        print("📋 Max age:", cors_rules[0].max_age_in_seconds, "seconds")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to configure CORS: {str(e)}")
        return False

if __name__ == "__main__":
    configure_cors() 
