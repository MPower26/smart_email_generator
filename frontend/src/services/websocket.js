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
    
    // Use a simple, direct WebSocket URL
    const wsUrl = 'wss://smart-email-backend-d8dcejbqe5h9bdcq.westeurope-01.azurewebsites.net/ws/progress/' + encodeURIComponent(userId);
    
    console.log('Attempting WebSocket connection to:', wsUrl);
    
    try {
      this.ws = new WebSocket(wsUrl);
      
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

  // Test WebSocket connection
  async testConnection() {
    return new Promise((resolve, reject) => {
      const testWs = new WebSocket('wss://smart-email-backend-d8dcejbqe5h9bdcq.westeurope-01.azurewebsites.net/ws/test');
      
      testWs.onopen = () => {
        console.log('Test WebSocket connected successfully');
        resolve(true);
      };
      
      testWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Test WebSocket message received:', data);
          testWs.close();
          resolve(data);
        } catch (error) {
          console.error('Error parsing test WebSocket message:', error);
          testWs.close();
          reject(error);
        }
      };
      
      testWs.onerror = (error) => {
        console.error('Test WebSocket error:', error);
        testWs.close();
        reject(error);
      };
      
      testWs.onclose = () => {
        console.log('Test WebSocket closed');
      };
      
      // Timeout after 5 seconds
      setTimeout(() => {
        testWs.close();
        reject(new Error('Test WebSocket connection timeout'));
      }, 5000);
    });
  }
}

export default new WebSocketService(); 
