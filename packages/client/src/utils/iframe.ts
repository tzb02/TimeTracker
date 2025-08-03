import React from 'react';

/**
 * Iframe detection and communication utilities
 */

export interface IframeInfo {
  isInIframe: boolean;
  parentOrigin: string | null;
  dimensions: {
    width: number;
    height: number;
  };
  restrictions: {
    localStorage: boolean;
    sessionStorage: boolean;
    webSocket: boolean;
    notifications: boolean;
    popups: boolean;
    sandboxRestrictions: string[];
  };
}

export interface PostMessageData {
  type: string;
  payload?: any;
  timestamp: number;
  source: 'time-tracker';
  version: string;
  requestId?: string;
}

export interface ParentFrameMessage {
  type: 'resize' | 'notification' | 'error' | 'ready' | 'timer-update' | 'config-request' | 'health-check';
  data?: any;
  requestId?: string;
}

export interface MessageResponse {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Detect if the application is running inside an iframe
 */
export const detectIframe = (): boolean => {
  try {
    return window.self !== window.top;
  } catch (e) {
    // If we can't access window.top due to cross-origin restrictions,
    // we're definitely in an iframe
    return true;
  }
};/**
 *
 Enhanced iframe information detection
 */
export const getIframeInfo = (): IframeInfo => {
  const isInIframe = detectIframe();
  
  // Test storage capabilities with more thorough checks
  const testStorage = (storage: Storage): boolean => {
    try {
      const testKey = '__iframe_test__';
      const testValue = 'test_value_' + Date.now();
      storage.setItem(testKey, testValue);
      const retrieved = storage.getItem(testKey);
      storage.removeItem(testKey);
      return retrieved === testValue;
    } catch (e) {
      return false;
    }
  };

  // Test WebSocket capability more safely
  const testWebSocket = (): boolean => {
    try {
      // Check if WebSocket is available and not blocked
      if (typeof WebSocket === 'undefined') return false;
      
      // Try to create a WebSocket without actually connecting
      const ws = new WebSocket('ws://localhost:0');
      const canCreate = ws.readyState !== undefined;
      ws.close();
      return canCreate;
    } catch (e) {
      return false;
    }
  };

  // Test notification capability
  const testNotifications = (): boolean => {
    return 'Notification' in window && 
           Notification.permission !== 'denied' &&
           typeof Notification.requestPermission === 'function';
  };

  // Test additional iframe restrictions
  const testPopups = (): boolean => {
    try {
      const popup = window.open('', '_blank', 'width=1,height=1');
      if (popup) {
        popup.close();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  // Detect iframe sandbox restrictions
  const getSandboxRestrictions = (): string[] => {
    const restrictions: string[] = [];
    
    try {
      // Check if we can access parent
      if (window.parent === window) {
        restrictions.push('allow-top-navigation');
      }
    } catch (e) {
      restrictions.push('allow-top-navigation');
    }

    // Check for other common restrictions
    if (!testPopups()) restrictions.push('allow-popups');
    if (!testStorage(localStorage)) restrictions.push('allow-storage-access-by-user-activation');
    
    return restrictions;
  };

  return {
    isInIframe,
    parentOrigin: isInIframe ? (document.referrer || null) : null,
    dimensions: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    restrictions: {
      localStorage: testStorage(localStorage),
      sessionStorage: testStorage(sessionStorage),
      webSocket: testWebSocket(),
      notifications: testNotifications(),
      popups: testPopups(),
      sandboxRestrictions: isInIframe ? getSandboxRestrictions() : [],
    },
  };
};

/**
 * Enhanced PostMessage API for parent frame communication
 */
export class IframeMessenger {
  private allowedOrigins: string[] = [
    'https://app.gohighlevel.com',
    'https://app.highlevel.com',
    'https://agency.gohighlevel.com',
    'https://agency.highlevel.com',
    // Additional GoHighLevel domains
    'https://app.gohighlevel.io',
    'https://app.highlevel.io',
    'https://app.ghl.co',
    'https://app.hl.co',
    // White-label domains
    'https://app.leadconnectorhq.com',
    'https://app.msgsndr.com',
  ];

  private allowedOriginPatterns: RegExp[] = [
    /^https:\/\/[a-zA-Z0-9-]+\.gohighlevel\.com$/,
    /^https:\/\/[a-zA-Z0-9-]+\.highlevel\.com$/,
    /^https:\/\/app\.[a-zA-Z0-9-]+\.gohighlevel\.com$/,
    /^https:\/\/app\.[a-zA-Z0-9-]+\.highlevel\.com$/,
    /^https:\/\/[a-zA-Z0-9-]+\.gohighlevel\.io$/,
    /^https:\/\/[a-zA-Z0-9-]+\.highlevel\.io$/,
    /^https:\/\/[a-zA-Z0-9-]+\.ghl\.co$/,
    /^https:\/\/[a-zA-Z0-9-]+\.hl\.co$/,
    /^https:\/\/[a-zA-Z0-9-]+\.leadconnectorhq\.com$/,
    /^https:\/\/[a-zA-Z0-9-]+\.msgsndr\.com$/,
  ];

  private messageHandlers: Map<string, (data: any, respond?: (response: MessageResponse) => void) => void> = new Map();
  private pendingRequests: Map<string, (response: MessageResponse) => void> = new Map();
  private messageQueue: PostMessageData[] = [];
  private isReady: boolean = false;
  private heartbeatInterval?: NodeJS.Timeout;
  private readonly version = '1.0.0';

  constructor() {
    // Add development origins
    if (process.env.NODE_ENV === 'development') {
      this.allowedOrigins.push(
        'http://localhost:3000',
        'https://localhost:3000',
        'http://localhost:5173',
        'https://localhost:5173',
        'http://127.0.0.1:3000',
        'https://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'https://127.0.0.1:5173'
      );

      this.allowedOriginPatterns.push(
        /^http:\/\/localhost:\d+$/,
        /^https:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
        /^https:\/\/127\.0\.0\.1:\d+$/
      );
    }

    this.setupMessageListener();
    this.startHeartbeat();
  }

  /**
   * Send message to parent frame with enhanced error handling
   */
  sendToParent(message: ParentFrameMessage): Promise<MessageResponse> {
    return new Promise((resolve, reject) => {
      if (!detectIframe()) {
        const error = 'Not in iframe, cannot send message to parent';
        console.warn(error);
        reject(new Error(error));
        return;
      }

      const requestId = message.requestId || this.generateRequestId();
      const messageData: PostMessageData = {
        type: message.type,
        payload: message.data,
        timestamp: Date.now(),
        source: 'time-tracker',
        version: this.version,
        requestId,
      };

      // Queue message if not ready
      if (!this.isReady && message.type !== 'ready') {
        this.messageQueue.push(messageData);
        resolve({ success: true, data: 'queued' });
        return;
      }

      try {
        // Set up response handler for requests that expect responses
        if (['config-request', 'health-check'].includes(message.type)) {
          const timeout = setTimeout(() => {
            this.pendingRequests.delete(requestId);
            reject(new Error('Message timeout'));
          }, 5000);

          this.pendingRequests.set(requestId, (response) => {
            clearTimeout(timeout);
            resolve(response);
          });
        }

        window.parent.postMessage(messageData, '*');
        
        // For non-response messages, resolve immediately
        if (!['config-request', 'health-check'].includes(message.type)) {
          resolve({ success: true });
        }
      } catch (error) {
        console.error('Failed to send message to parent:', error);
        reject(error);
      }
    });
  }

  /**
   * Send message to parent frame (legacy sync method)
   */
  sendToParentSync(message: ParentFrameMessage): void {
    this.sendToParent(message).catch(error => {
      console.error('Failed to send message to parent:', error);
    });
  } 
 /**
   * Register handler for messages from parent with response capability
   */
  onMessage(type: string, handler: (data: any, respond?: (response: MessageResponse) => void) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Remove message handler
   */
  offMessage(type: string): void {
    this.messageHandlers.delete(type);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start heartbeat to maintain connection with parent
   */
  private startHeartbeat(): void {
    if (!detectIframe()) return;

    this.heartbeatInterval = setInterval(() => {
      this.sendToParentSync({
        type: 'health-check',
        data: { timestamp: Date.now() }
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        try {
          window.parent.postMessage(message, '*');
        } catch (error) {
          console.error('Failed to send queued message:', error);
        }
      }
    }
  }

  /**
   * Enhanced setup message listener for parent frame messages
   */
  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      // Validate origin for security
      if (!this.isAllowedOrigin(event.origin)) {
        console.warn('Received message from unauthorized origin:', event.origin);
        return;
      }

      // Validate message structure
      if (!this.isValidMessage(event.data)) {
        console.warn('Received invalid message format:', event.data);
        return;
      }

      const { type, payload, requestId } = event.data;

      // Handle response messages
      if (requestId && this.pendingRequests.has(requestId)) {
        const responseHandler = this.pendingRequests.get(requestId);
        if (responseHandler) {
          responseHandler(payload);
          this.pendingRequests.delete(requestId);
        }
        return;
      }

      // Handle regular messages
      const handler = this.messageHandlers.get(type);
      
      if (handler) {
        try {
          // Create response function for handlers that need to respond
          const respond = requestId ? (response: MessageResponse) => {
            try {
              window.parent.postMessage({
                type: 'response',
                payload: response,
                timestamp: Date.now(),
                source: 'time-tracker',
                version: this.version,
                requestId,
              }, '*');
            } catch (error) {
              console.error('Failed to send response:', error);
            }
          } : undefined;

          handler(payload, respond);
        } catch (error) {
          console.error(`Error handling message type ${type}:`, error);
          
          // Send error response if requestId is present
          if (requestId) {
            try {
              window.parent.postMessage({
                type: 'response',
                payload: { success: false, error: error.message },
                timestamp: Date.now(),
                source: 'time-tracker',
                version: this.version,
                requestId,
              }, '*');
            } catch (sendError) {
              console.error('Failed to send error response:', sendError);
            }
          }
        }
      } else {
        console.warn(`No handler registered for message type: ${type}`);
      }
    });
  }

  /**
   * Enhanced origin validation
   */
  private isAllowedOrigin(origin: string): boolean {
    // Check exact matches
    if (this.allowedOrigins.includes(origin)) {
      return true;
    }

    // Check pattern matches
    return this.allowedOriginPatterns.some(pattern => pattern.test(origin));
  }

  /**
   * Enhanced message validation
   */
  private isValidMessage(data: any): data is PostMessageData {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.type === 'string' &&
      typeof data.timestamp === 'number' &&
      (data.source === 'time-tracker' || data.source === 'parent-frame') &&
      (!data.version || typeof data.version === 'string')
    );
  }  /**
  
 * Notify parent about app ready state
   */
  notifyReady(): void {
    this.isReady = true;
    this.sendToParentSync({
      type: 'ready',
      data: {
        version: this.version,
        capabilities: getIframeInfo(),
        supportedMessages: [
          'resize', 'notification', 'error', 'timer-update', 
          'config-request', 'health-check'
        ],
      },
    });
    
    // Process any queued messages
    this.processMessageQueue();
  }

  /**
   * Request parent to resize iframe
   */
  requestResize(width?: number, height?: number): Promise<MessageResponse> {
    return this.sendToParent({
      type: 'resize',
      data: { width, height, timestamp: Date.now() },
    });
  }

  /**
   * Send timer update to parent
   */
  notifyTimerUpdate(timerData: any): void {
    this.sendToParentSync({
      type: 'timer-update',
      data: {
        ...timerData,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Send error notification to parent
   */
  notifyError(error: string, details?: any): void {
    this.sendToParentSync({
      type: 'error',
      data: { 
        error, 
        details, 
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
    });
  }

  /**
   * Send general notification to parent
   */
  notify(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    this.sendToParentSync({
      type: 'notification',
      data: { 
        message, 
        type, 
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Request configuration from parent
   */
  requestConfig(): Promise<MessageResponse> {
    return this.sendToParent({
      type: 'config-request',
      data: { timestamp: Date.now() },
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopHeartbeat();
    this.messageHandlers.clear();
    this.pendingRequests.clear();
    this.messageQueue.length = 0;
    this.isReady = false;
  }
}

// Global iframe messenger instance
export const iframeMessenger = new IframeMessenger();

/**
 * Hook for iframe detection and info
 */
export const useIframeInfo = () => {
  const [iframeInfo, setIframeInfo] = React.useState<IframeInfo>(() => getIframeInfo());

  React.useEffect(() => {
    const updateInfo = () => {
      setIframeInfo(getIframeInfo());
    };

    window.addEventListener('resize', updateInfo);
    return () => window.removeEventListener('resize', updateInfo);
  }, []);

  return iframeInfo;
};/**

 * Enhanced fallback mechanisms for blocked iframe features
 */
export class IframeFallbacks {
  private static memoryStorage: Map<string, string> = new Map();
  private static storageEventListeners: Set<(event: StorageEvent) => void> = new Set();

  /**
   * Enhanced fallback for localStorage when blocked
   */
  static createMemoryStorage(): Storage {
    const storage = this.memoryStorage;
    
    return {
      getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, value: string) => {
        const oldValue = storage.get(key) || null;
        storage.set(key, value);
        
        // Simulate storage event
        this.dispatchStorageEvent(key, oldValue, value);
      },
      removeItem: (key: string) => {
        const oldValue = storage.get(key) || null;
        storage.delete(key);
        
        // Simulate storage event
        this.dispatchStorageEvent(key, oldValue, null);
      },
      clear: () => {
        storage.clear();
        this.dispatchStorageEvent(null, null, null);
      },
      key: (index: number) => Array.from(storage.keys())[index] || null,
      get length() { return storage.size; },
    };
  }

  /**
   * Dispatch storage event for memory storage
   */
  private static dispatchStorageEvent(key: string | null, oldValue: string | null, newValue: string | null) {
    try {
      const event = new StorageEvent('storage', {
        key,
        oldValue,
        newValue,
        url: window.location.href,
        storageArea: null, // Set to null to avoid JSDOM issues
      });

      this.storageEventListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in storage event listener:', error);
        }
      });
    } catch (error) {
      // Fallback for environments where StorageEvent constructor fails
      console.warn('StorageEvent not supported, skipping event dispatch');
    }
  }

  /**
   * Add storage event listener for memory storage
   */
  static addStorageEventListener(listener: (event: StorageEvent) => void) {
    this.storageEventListeners.add(listener);
  }

  /**
   * Remove storage event listener for memory storage
   */
  static removeStorageEventListener(listener: (event: StorageEvent) => void) {
    this.storageEventListeners.delete(listener);
  }

  /**
   * Enhanced fallback for WebSocket when blocked - use polling with exponential backoff
   */
  static createPollingFallback(url: string, initialInterval: number = 5000) {
    const eventTarget = new EventTarget();
    let isConnected = false;
    let pollInterval: NodeJS.Timeout;
    let currentInterval = initialInterval;
    let maxInterval = 30000; // 30 seconds max
    let retryCount = 0;
    let lastSuccessTime = 0;

    const resetInterval = () => {
      currentInterval = initialInterval;
      retryCount = 0;
    };

    const increaseInterval = () => {
      retryCount++;
      currentInterval = Math.min(currentInterval * 1.5, maxInterval);
    };

    const startPolling = () => {
      const poll = async () => {
        try {
          const httpUrl = url.replace('ws://', 'http://').replace('wss://', 'https://');
          const response = await fetch(`${httpUrl}/poll`, {
            method: 'GET',
            headers: {
              'X-Iframe-Request': 'true',
              'X-Last-Success': lastSuccessTime.toString(),
            },
          });

          if (response.ok) {
            const data = await response.json();
            lastSuccessTime = Date.now();
            resetInterval();
            
            if (data.messages && Array.isArray(data.messages)) {
              data.messages.forEach((message: any) => {
                eventTarget.dispatchEvent(new CustomEvent('message', { detail: message }));
              });
            }
          } else {
            increaseInterval();
          }
        } catch (error) {
          increaseInterval();
          eventTarget.dispatchEvent(new CustomEvent('error', { detail: error }));
        }

        if (isConnected) {
          pollInterval = setTimeout(poll, currentInterval);
        }
      };

      poll();
    };

    return {
      addEventListener: (type: string, listener: EventListener) => {
        eventTarget.addEventListener(type, listener);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        eventTarget.removeEventListener(type, listener);
      },
      connect: () => {
        if (!isConnected) {
          isConnected = true;
          resetInterval();
          startPolling();
          eventTarget.dispatchEvent(new CustomEvent('open'));
        }
      },
      disconnect: () => {
        if (isConnected) {
          isConnected = false;
          if (pollInterval) {
            clearTimeout(pollInterval);
          }
          eventTarget.dispatchEvent(new CustomEvent('close'));
        }
      },
      send: async (data: any) => {
        try {
          const httpUrl = url.replace('ws://', 'http://').replace('wss://', 'https://');
          await fetch(`${httpUrl}/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Iframe-Request': 'true',
            },
            body: JSON.stringify(data),
          });
        } catch (error) {
          console.error('Failed to send message via polling fallback:', error);
          eventTarget.dispatchEvent(new CustomEvent('error', { detail: error }));
        }
      },
      get readyState() {
        return isConnected ? 1 : 0; // OPEN : CONNECTING
      },
    };
  }  /**

   * Enhanced fallback for notifications when blocked
   */
  static createNotificationFallback() {
    const notifications: Map<string, any> = new Map();

    return {
      show: (title: string, options?: NotificationOptions) => {
        const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const notification = {
          id,
          title,
          body: options?.body || '',
          icon: options?.icon,
          timestamp: Date.now(),
        };

        notifications.set(id, notification);

        // Use iframe messenger to show notification in parent
        iframeMessenger.notify(`${title}${options?.body ? ': ' + options.body : ''}`, 'info');

        // Return a notification-like object
        return {
          close: () => {
            notifications.delete(id);
          },
          onclick: options?.onclick || null,
          onclose: options?.onclose || null,
          onerror: options?.onerror || null,
          onshow: options?.onshow || null,
        };
      },
      requestPermission: () => Promise.resolve('granted' as NotificationPermission),
      get permission() {
        return 'granted' as NotificationPermission;
      },
    };
  }

  /**
   * Fallback for popup windows when blocked
   */
  static createPopupFallback() {
    return {
      open: (url: string, target: string = '_blank', features?: string) => {
        // Try to use iframe messenger to request parent to open popup
        iframeMessenger.sendToParentSync({
          type: 'popup-request',
          data: { url, target, features },
        });

        // Return a mock window object
        return {
          closed: false,
          close: () => {
            iframeMessenger.sendToParentSync({
              type: 'popup-close',
              data: { url },
            });
          },
          focus: () => {
            iframeMessenger.sendToParentSync({
              type: 'popup-focus',
              data: { url },
            });
          },
        };
      },
    };
  }

  /**
   * Detect and setup all necessary fallbacks
   */
  static setupFallbacks(iframeInfo: IframeInfo) {
    const fallbacks: string[] = [];

    // Setup localStorage fallback
    if (!iframeInfo.restrictions.localStorage) {
      const memoryStorage = this.createMemoryStorage();
      (window as any).localStorage = memoryStorage;
      fallbacks.push('localStorage');
    }

    // Setup sessionStorage fallback
    if (!iframeInfo.restrictions.sessionStorage) {
      const memoryStorage = this.createMemoryStorage();
      (window as any).sessionStorage = memoryStorage;
      fallbacks.push('sessionStorage');
    }

    // Setup notification fallback
    if (!iframeInfo.restrictions.notifications) {
      const notificationFallback = this.createNotificationFallback();
      (window as any).Notification = notificationFallback;
      fallbacks.push('Notification');
    }

    // Setup popup fallback
    if (!iframeInfo.restrictions.popups) {
      const popupFallback = this.createPopupFallback();
      const originalOpen = window.open;
      window.open = popupFallback.open as any;
      fallbacks.push('window.open');
    }

    return fallbacks;
  }
}