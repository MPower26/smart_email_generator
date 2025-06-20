class WebSocketService {
  constructor() {
    this.ws = null;
    this.userId = null;
    this.onProgressCallback = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  connect(userId) {
    this.userId = userId;
    
    // Get the base URL and ensure it's properly formatted for WebSocket
    let baseUrl = process.env.REACT_APP_BACKEND_URL || 
                  'https://smart-email-backend-d8dcejbqe5h9bdcq.westeurope-01.azurewebsites.net';
    
    // Convert to WebSocket URL
    let wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    
    // Ensure no trailing slash
    wsUrl = wsUrl.replace(/\/$/, '');
    
    const fullWsUrl = `${wsUrl}/ws/progress/${encodeURIComponent(userId)}`;
    
    console.log('Attempting WebSocket connection to:', fullWsUrl);
    
    try {
      this.ws = new WebSocket(fullWsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        this.reconnectAttempts = 0;
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          if (this.onProgressCallback) {
            this.onProgressCallback(data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect(this.userId);
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.log('Max reconnection attempts reached. WebSocket connection failed.');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  onProgress(callback) {
    this.onProgressCallback = callback;
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

export default new WebSocketService(); 
