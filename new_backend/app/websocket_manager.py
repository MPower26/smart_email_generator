import logging
import json
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages active WebSocket connections."""
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept and store a new WebSocket connection."""
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"WebSocket connected for user {user_id}. Total connections for user: {len(self.active_connections[user_id])}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove a WebSocket connection."""
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
        logger.info(f"WebSocket disconnected for user {user_id}.")

    async def send_progress(self, user_id: str, progress_data: dict):
        """Send progress data to all connections for a specific user."""
        logger.info(f"Attempting to send progress to user {user_id}: {progress_data}")
        
        if user_id in self.active_connections:
            logger.info(f"Found {len(self.active_connections[user_id])} active connections for user {user_id}")
            # Create a copy of the list to iterate over, as connections might be removed during the loop
            for connection in list(self.active_connections[user_id]):
                try:
                    await connection.send_text(json.dumps(progress_data))
                    logger.info(f"Successfully sent progress to user {user_id}")
                except Exception as e:
                    logger.error(f"Failed to send progress to user {user_id}: {str(e)}")
                    # If sending fails, assume the connection is broken and remove it
                    self.disconnect(connection, user_id)
        else:
            logger.warning(f"No active connections found for user {user_id}")

# Create a single, shared instance of the manager
manager = ConnectionManager() 
