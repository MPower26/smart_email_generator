import os
import uuid
import time
from typing import Optional
from azure.storage.blob import BlobServiceClient, ContentSettings
from fastapi import HTTPException
import logging
import subprocess

logger = logging.getLogger(__name__)

def format_file_size(size_bytes: int) -> str:
    """Format file size in human readable format"""
    if size_bytes == 0:
        return "0B"
    size_names = ["B", "KB", "MB", "GB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    return f"{size_bytes:.1f}{size_names[i]}"

def format_speed(bytes_per_second: float) -> str:
    """Format transfer speed in human readable format"""
    if bytes_per_second == 0:
        return "0 B/s"
    speed_names = ["B/s", "KB/s", "MB/s", "GB/s"]
    i = 0
    while bytes_per_second >= 1024 and i < len(speed_names) - 1:
        bytes_per_second /= 1024.0
        i += 1
    return f"{bytes_per_second:.1f} {speed_names[i]}"

def format_time(seconds: float) -> str:
    """Format time in human readable format"""
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        minutes = int(seconds // 60)
        remaining_seconds = seconds % 60
        return f"{minutes}m {remaining_seconds:.0f}s"
    else:
        hours = int(seconds // 3600)
        remaining_minutes = int((seconds % 3600) // 60)
        return f"{hours}h {remaining_minutes}m"

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
        
        file_size = len(file_content)
        start_time = time.time()
        
        try:
            logger.info(f"🚀 Starting signature image upload for user: {user_email}")
            logger.info(f"📁 File size: {format_file_size(file_size)}")
            logger.info(f"📊 Estimated upload time: {self._estimate_upload_time(file_size)}")
            
            # Generate unique filename
            filename = f"{user_email}_{uuid.uuid4()}{file_extension}"
            blob_name = f"signatures/{filename}"
            
            logger.info(f"📝 Generated blob name: {blob_name}")
            
            # Get blob client
            blob_client = self.client.get_blob_client(
                container=self.container_name, 
                blob=blob_name
            )
            
            # Determine content type based on file extension
            content_type = self._get_content_type(file_extension)
            logger.info(f"🎯 Content type: {content_type}")
            
            # Upload the file
            logger.info("⏳ Starting blob upload to Azure...")
            upload_start = time.time()
            
            blob_client.upload_blob(
                file_content,
                content_settings=ContentSettings(content_type=content_type),
                overwrite=True,
                timeout=300  # 5 minutes timeout
            )
            
            upload_duration = time.time() - upload_start
            total_duration = time.time() - start_time
            speed = file_size / upload_duration if upload_duration > 0 else 0
            
            logger.info(f"✅ Signature image upload completed successfully!")
            logger.info(f"📈 Upload statistics:")
            logger.info(f"   • Duration: {format_time(upload_duration)}")
            logger.info(f"   • Speed: {format_speed(speed)}")
            logger.info(f"   • Total time: {format_time(total_duration)}")
            logger.info(f"🔗 URL: {blob_client.url}")
            
            # Return the public URL
            return blob_client.url
            
        except Exception as e:
            elapsed_time = time.time() - start_time
            logger.error(f"❌ Failed to upload signature image for user {user_email}")
            logger.error(f"📊 Upload failed after {format_time(elapsed_time)}")
            logger.error(f"📁 File size: {format_file_size(file_size)}, extension: {file_extension}")
            logger.error(f"💥 Error: {str(e)}")
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to upload image: {str(e)}"
            )
    
    def _generate_gif_from_video(self, video_path: str, gif_path: str, duration: int = 2) -> bool:
        """Generate a GIF from the first few seconds of a video using FFmpeg."""
        try:
            cmd = [
                "ffmpeg", "-y", "-ss", "0", "-t", str(duration), "-i", video_path,
                "-vf", "fps=10,scale=320:-1:flags=lanczos", "-gifflags", "+transdiff", gif_path
            ]
            subprocess.run(cmd, check=True)
            return True
        except Exception as e:
            logger.error(f"Failed to generate GIF preview: {e}")
            return False

    async def upload_attachment(self, file_content: bytes, file_extension: str, user_email: str, is_video: bool = False) -> (str, str):
        """
        Upload an attachment (image or video) to Azure Blob Storage with ETA. If video, also generate and upload GIF preview.
        Returns (blob_url, gif_url)
        """
        if not self.client:
            raise HTTPException(
                status_code=500,
                detail="Blob storage not configured. Please set AZURE_STORAGE_CONNECTION_STRING environment variable."
            )
        file_size = len(file_content)
        start_time = time.time()
        gif_url = None
        try:
            logger.info(f"🚀 Starting attachment upload for user: {user_email}")
            logger.info(f"📁 File size: {format_file_size(file_size)}")
            estimated_upload_time = self._estimate_upload_time_seconds(file_size)
            eta_time = time.time() + estimated_upload_time
            eta_str = time.strftime("%H:%M:%S", time.localtime(eta_time))
            logger.info(f"📊 Estimated upload time: {format_time(estimated_upload_time)}")
            logger.info(f"⏰ Expected completion: {eta_str}")
            filename = f"{user_email}_{uuid.uuid4()}{file_extension}"
            blob_name = f"attachments/{filename}"
            logger.info(f"📝 Generated blob name: {blob_name}")
            blob_client = self.client.get_blob_client(
                container=self.container_name,
                blob=blob_name
            )
            content_type = self._get_content_type(file_extension)
            logger.info(f"🎯 Content type: {content_type}")
            
            # For videos, ensure they can be played in-browser
            content_settings = ContentSettings(content_type=content_type)
            if is_video:
                content_settings = ContentSettings(
                    content_type=content_type,
                    content_disposition="inline"
                )
                logger.info("🎬 Video detected - setting Content-Disposition: inline for in-browser playback")
            
            logger.info("⏳ Starting blob upload to Azure...")
            upload_start = time.time()
            timeout_seconds = max(600, estimated_upload_time * 2)
            logger.info(f"⏱️ Upload timeout set to: {format_time(timeout_seconds)}")
            blob_client.upload_blob(
                file_content,
                content_settings=content_settings,
                overwrite=True,
                timeout=timeout_seconds
            )
            upload_duration = time.time() - upload_start
            total_duration = time.time() - start_time
            speed = file_size / upload_duration if upload_duration > 0 else 0
            logger.info(f"✅ Upload completed successfully!")
            logger.info(f"📈 Upload statistics:")
            logger.info(f"   • Duration: {format_time(upload_duration)}")
            logger.info(f"   • Speed: {format_speed(speed)}")
            logger.info(f"   • Total time: {format_time(total_duration)}")
            logger.info(f"   • Estimated vs Actual: {format_time(estimated_upload_time)} vs {format_time(upload_duration)}")
            logger.info(f"🔗 URL: {blob_client.url}")
            blob_url = blob_client.url
            # If video, generate GIF preview
            if is_video:
                import tempfile
                with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_video:
                    tmp_video.write(file_content)
                    tmp_video.flush()
                    gif_path = tmp_video.name.replace(file_extension, ".gif")
                    if self._generate_gif_from_video(tmp_video.name, gif_path):
                        # Upload GIF to blob storage
                        gif_filename = f"{user_email}_{uuid.uuid4()}.gif"
                        gif_blob_name = f"attachments/{gif_filename}"
                        gif_blob_client = self.client.get_blob_client(
                            container=self.container_name,
                            blob=gif_blob_name
                        )
                        with open(gif_path, "rb") as gif_file:
                            gif_blob_client.upload_blob(
                                gif_file.read(),
                                content_settings=ContentSettings(content_type="image/gif"),
                                overwrite=True
                            )
                        gif_url = gif_blob_client.url
                        logger.info(f"✅ GIF preview uploaded: {gif_url}")
                    else:
                        logger.warning("GIF preview generation failed; no GIF will be attached.")
            return blob_url, gif_url
        except Exception as e:
            elapsed_time = time.time() - start_time
            logger.error(f"❌ Failed to upload attachment for user {user_email}")
            logger.error(f"📊 Upload failed after {format_time(elapsed_time)}")
            logger.error(f"📁 File size: {format_file_size(file_size)}, extension: {file_extension}")
            logger.error(f"💥 Error: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Upload failed: {str(e)}"
            )
    
    def _estimate_upload_time_seconds(self, file_size: int) -> float:
        """Estimate upload time in seconds based on file size"""
        # Assume average speed of 2 MB/s for estimation (more realistic)
        estimated_seconds = file_size / (2 * 1024 * 1024)  # 2 MB/s
        return max(estimated_seconds, 30)  # Minimum 30 seconds
    
    def _estimate_upload_time(self, file_size: int) -> str:
        """Estimate upload time based on file size"""
        estimated_seconds = self._estimate_upload_time_seconds(file_size)
        return format_time(estimated_seconds)
    
    def _get_content_type(self, file_extension: str) -> str:
        """Get the content type based on file extension"""
        content_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
            '.svg': 'image/svg+xml',
            # Video formats with proper MIME types for in-browser playback
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.wmv': 'video/x-ms-wmv',
            '.mkv': 'video/x-matroska',
            '.webm': 'video/webm',
            '.flv': 'video/x-flv',
            '.m4v': 'video/x-m4v',
            '.3gp': 'video/3gpp',
            '.ogv': 'video/ogg',
            '.ts': 'video/mp2t',
            '.mts': 'video/mp2t',
            '.m2ts': 'video/mp2t',
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

    async def upload_chunk(self, chunk_content: bytes, upload_id: str, chunk_index: int, file_extension: str, user_email: str) -> str:
        """Upload a single chunk to blob storage under chunks/{upload_id}/{chunk_index}"""
        if not self.client:
            raise HTTPException(status_code=500, detail="Blob storage not configured.")
        blob_name = f"chunks/{upload_id}/{chunk_index}{file_extension}"
        blob_client = self.client.get_blob_client(container=self.container_name, blob=blob_name)
        content_type = self._get_content_type(file_extension)
        blob_client.upload_blob(chunk_content, content_settings=ContentSettings(content_type=content_type), overwrite=True)
        return blob_client.url

    async def list_chunks(self, upload_id: str) -> list:
        """List all chunk blob names for a given upload_id"""
        if not self.client:
            raise HTTPException(status_code=500, detail="Blob storage not configured.")
        container_client = self.client.get_container_client(self.container_name)
        prefix = f"chunks/{upload_id}/"
        return [blob.name for blob in container_client.list_blobs(name_starts_with=prefix)]

    async def download_chunk(self, blob_name: str) -> bytes:
        """Download a chunk by blob name"""
        if not self.client:
            raise HTTPException(status_code=500, detail="Blob storage not configured.")
        blob_client = self.client.get_blob_client(container=self.container_name, blob=blob_name)
        download_stream = blob_client.download_blob()
        return download_stream.readall()

    async def assemble_chunks(self, upload_id: str, total_chunks: int, file_extension: str, user_email: str) -> bytes:
        """Download and concatenate all chunks for upload_id in order, return the assembled file bytes"""
        chunk_names = [f"chunks/{upload_id}/{i}{file_extension}" for i in range(total_chunks)]
        assembled = b''
        for name in chunk_names:
            assembled += await self.download_chunk(name)
        return assembled

    async def delete_chunks(self, upload_id: str, total_chunks: int, file_extension: str):
        """Delete all chunk blobs for upload_id"""
        for i in range(total_chunks):
            blob_name = f"chunks/{upload_id}/{i}{file_extension}"
            blob_client = self.client.get_blob_client(container=self.container_name, blob=blob_name)
            try:
                blob_client.delete_blob()
            except Exception:
                pass

# Global instance
blob_storage_service = BlobStorageService() 
