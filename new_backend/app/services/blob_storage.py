import os
import uuid
from typing import Optional
from azure.storage.blob import BlobServiceClient, ContentSettings
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

class BlobStorageService:
    def __init__(self):
        # Get connection string from environment variable
        self.connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
        self.container_name = os.getenv('AZURE_STORAGE_CONTAINER_NAME', 'signatures')
        
        if not self.connection_string:
            logger.warning("AZURE_STORAGE_CONNECTION_STRING not found in environment variables")
            self.client = None
        else:
            try:
                self.client = BlobServiceClient.from_connection_string(self.connection_string)
                # Ensure container exists
                self._ensure_container_exists()
            except Exception as e:
                logger.error(f"Failed to initialize blob storage client: {str(e)}")
                self.client = None
    
    def _ensure_container_exists(self):
        """Ensure the container exists, create if it doesn't"""
        try:
            container_client = self.client.get_container_client(self.container_name)
            container_client.get_container_properties()
        except Exception:
            # Container doesn't exist, create it
            self.client.create_container(self.container_name)
            logger.info(f"Created container: {self.container_name}")
    
    async def upload_signature_image(self, file_content: bytes, file_extension: str, user_email: str) -> Optional[str]:
        """
        Upload a signature image to Azure Blob Storage
        
        Args:
            file_content: The file content as bytes
            file_extension: The file extension (e.g., '.jpg', '.png')
            user_email: The user's email for naming the file
            
        Returns:
            The public URL of the uploaded image, or None if upload failed
        """
        if not self.client:
            raise HTTPException(
                status_code=500, 
                detail="Blob storage not configured. Please set AZURE_STORAGE_CONNECTION_STRING environment variable."
            )
        
        try:
            # Generate unique filename
            filename = f"{user_email}_{uuid.uuid4()}{file_extension}"
            blob_name = f"signatures/{filename}"
            
            # Get blob client
            blob_client = self.client.get_blob_client(
                container=self.container_name, 
                blob=blob_name
            )
            
            # Determine content type based on file extension
            content_type = self._get_content_type(file_extension)
            
            # Upload the file
            blob_client.upload_blob(
                file_content,
                content_settings=ContentSettings(content_type=content_type),
                overwrite=True
            )
            
            # Return the public URL
            return blob_client.url
            
        except Exception as e:
            logger.error(f"Failed to upload signature image: {str(e)}")
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to upload image: {str(e)}"
            )
    
    def _get_content_type(self, file_extension: str) -> str:
        """Get the content type based on file extension"""
        content_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        }
        return content_types.get(file_extension.lower(), 'application/octet-stream')
    
    async def delete_signature_image(self, image_url: str) -> bool:
        """
        Delete a signature image from Azure Blob Storage
        
        Args:
            image_url: The URL of the image to delete
            
        Returns:
            True if deletion was successful, False otherwise
        """
        if not self.client:
            logger.warning("Blob storage not configured, cannot delete image")
            return False
        
        try:
            # Extract blob name from URL
            # URL format: https://account.blob.core.windows.net/container/signatures/filename
            blob_name = image_url.split(f"{self.container_name}/")[-1]
            
            # Get blob client
            blob_client = self.client.get_blob_client(
                container=self.container_name, 
                blob=blob_name
            )
            
            # Delete the blob
            blob_client.delete_blob()
            logger.info(f"Deleted signature image: {blob_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete signature image: {str(e)}")
            return False

# Global instance
blob_storage_service = BlobStorageService() 
