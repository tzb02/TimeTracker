import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  detectIframe, 
  getIframeInfo, 
  IframeMessenger, 
  IframeFallbacks 
} from '../iframe';

// Mock window object for iframe testing
const createMockWindow = (isIframe: boolean = false, restrictions: any = {}) => {
  const mockWindow = {
    self: {},
    top: isIframe ? {} : undefined,
    parent: {
      postMessage: vi.fn(),
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    innerWidth: 800,
    innerHeight: 600,
    location: {
      href: 'https://app.gohighlevel.com/iframe-test',
    },
    navigator: {
      userAgent: 'Mozilla/5.0 (Test Browser)',
    },
    localStorage: {
      setItem: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    },
    sessionStorage: {
      setItem: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    },
    WebSocket: vi.fn(),
    Notification: {
      permission: 'granted',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    },
    open: vi.fn(),
    document: {
      referrer: isIframe ? 'https://app.gohighlevel.com' : '',
    },
  };

  // Apply restrictions
  if (restrictions.localStorage === false) {
    mockWindow.localStorage.setItem = vi.fn().mockImplementation(() => {
      throw new Error('localStorage blocked');
    });
    mockWindow.localStorage.getItem = vi.fn().mockImplementation(() => {
      throw new Error('localStorage blocked');
    });
    mockWindow.localStorage.removeItem = vi.fn().mockImplementation(() => {
      throw new Error('localStorage blocked');
    });
  }

  if (restrictions.webSocket === false) {
    mockWindow.WebSocket = vi.fn().mockImplementation(() => {
      throw new Error('WebSocket blocked');
    });
    // Also override the global WebSocket for this test
    if (typeof global !== 'undefined') {
      global.WebSocket = mockWindow.WebSocket as any;
    }
  }

  if (restrictions.notifications === false) {
    mockWindow.Notification.permission = 'denied';
    // Also override the global Notification for this test
    if (typeof global !== 'undefined') {
      global.Notification = mockWindow.Notification as any;
    }
  }

  if (restrictions.popups === false) {
    mockWindow.open = vi.fn().mockReturnValue(null);
  }

  return mockWindow;
};

describe('Iframe Embedding Tests', () => {
  let originalWindow: any;

  beforeEach(() => {
    originalWindow = global.window;
    vi.clearAllMocks();
    
    // Mock global Notification API
    global.Notification = {
      permission: 'granted',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    } as any;
    
    // Mock global WebSocket
    global.WebSocket = vi.fn().mockImplementation(() => ({
      readyState: 1,
      close: vi.fn(),
    })) as any;
  });

  afterEach(() => {
    global.window = originalWindow;
    delete (global as any).Notification;
    delete (global as any).WebSocket;
  });  describe
('GoHighLevel Iframe Environment', () => {
    it('should detect GoHighLevel iframe correctly', () => {
      const mockWindow = createMockWindow(true);
      global.window = mockWindow as any;
      global.document = mockWindow.document as any;

      const isIframe = detectIframe();
      const iframeInfo = getIframeInfo();

      expect(isIframe).toBe(true);
      expect(iframeInfo.isInIframe).toBe(true);
      expect(iframeInfo.parentOrigin).toBe('https://app.gohighlevel.com');
    });

    it('should handle GoHighLevel subdomain variations', () => {
      const subdomains = [
        'https://app.gohighlevel.com',
        'https://agency.gohighlevel.com',
        'https://custom.gohighlevel.com',
        'https://app.highlevel.com',
        'https://agency.highlevel.com',
      ];

      subdomains.forEach(subdomain => {
        const mockWindow = createMockWindow(true);
        mockWindow.document.referrer = subdomain;
        global.window = mockWindow as any;

        const messenger = new IframeMessenger();
        expect(() => {
          messenger.sendToParentSync({
            type: 'ready',
            data: { test: true },
          });
        }).not.toThrow();
      });
    });

    it('should handle iframe with storage restrictions', () => {
      const mockWindow = createMockWindow(true, { localStorage: false });
      global.window = mockWindow as any;
      global.document = mockWindow.document as any;
      
      // Override global localStorage to match the mock
      const originalLocalStorage = global.localStorage;
      global.localStorage = mockWindow.localStorage as any;

      const iframeInfo = getIframeInfo();
      expect(iframeInfo.restrictions.localStorage).toBe(false);

      const fallbacks = IframeFallbacks.setupFallbacks(iframeInfo);
      expect(fallbacks).toContain('localStorage');
      
      // Restore original localStorage
      global.localStorage = originalLocalStorage;
    });

    it('should handle iframe with WebSocket restrictions', () => {
      const mockWindow = createMockWindow(true, { webSocket: false });
      global.window = mockWindow as any;
      global.document = mockWindow.document as any;

      const iframeInfo = getIframeInfo();
      expect(iframeInfo.restrictions.webSocket).toBe(false);

      const pollingFallback = IframeFallbacks.createPollingFallback('ws://localhost:3001');
      expect(pollingFallback).toBeDefined();
      expect(typeof pollingFallback.connect).toBe('function');
    });
  });

  describe('Cross-Origin Security', () => {
    it('should reject messages from unauthorized origins', () => {
      const mockWindow = createMockWindow(true);
      global.window = mockWindow as any;

      const messenger = new IframeMessenger();
      const handler = vi.fn();
      messenger.onMessage('test', handler);

      // Simulate message from unauthorized origin
      const unauthorizedEvent = {
        origin: 'https://malicious-site.com',
        data: {
          type: 'test',
          payload: { malicious: true },
          timestamp: Date.now(),
          source: 'time-tracker',
          version: '1.0.0',
        },
      };

      const messageListener = mockWindow.addEventListener.mock.calls
        .find(call => call[0] === 'message')?.[1];
      
      if (messageListener) {
        messageListener(unauthorizedEvent);
      }

      expect(handler).not.toHaveBeenCalled();
    });

    it('should accept messages from authorized GoHighLevel origins', () => {
      const mockWindow = createMockWindow(true);
      global.window = mockWindow as any;

      const messenger = new IframeMessenger();
      const handler = vi.fn();
      messenger.onMessage('test', handler);

      // Simulate message from authorized origin
      const authorizedEvent = {
        origin: 'https://app.gohighlevel.com',
        data: {
          type: 'test',
          payload: { authorized: true },
          timestamp: Date.now(),
          source: 'parent-frame',
          version: '1.0.0',
        },
      };

      const messageListener = mockWindow.addEventListener.mock.calls
        .find(call => call[0] === 'message')?.[1];
      
      if (messageListener) {
        messageListener(authorizedEvent);
      }

      expect(handler).toHaveBeenCalledWith({ authorized: true }, undefined);
    });
  });

  describe('Responsive Layout Adaptation', () => {
    it('should adapt to small iframe dimensions', () => {
      const mockWindow = createMockWindow(true);
      mockWindow.innerWidth = 300;
      mockWindow.innerHeight = 250;
      global.window = mockWindow as any;

      const iframeInfo = getIframeInfo();
      expect(iframeInfo.dimensions.width).toBe(300);
      expect(iframeInfo.dimensions.height).toBe(250);
    });

    it('should adapt to medium iframe dimensions', () => {
      const mockWindow = createMockWindow(true);
      mockWindow.innerWidth = 500;
      mockWindow.innerHeight = 400;
      global.window = mockWindow as any;

      const iframeInfo = getIframeInfo();
      expect(iframeInfo.dimensions.width).toBe(500);
      expect(iframeInfo.dimensions.height).toBe(400);
    });

    it('should adapt to large iframe dimensions', () => {
      const mockWindow = createMockWindow(true);
      mockWindow.innerWidth = 800;
      mockWindow.innerHeight = 600;
      global.window = mockWindow as any;

      const iframeInfo = getIframeInfo();
      expect(iframeInfo.dimensions.width).toBe(800);
      expect(iframeInfo.dimensions.height).toBe(600);
    });
  });

  describe('Fallback Mechanisms', () => {
    it('should create memory storage fallback', () => {
      const memoryStorage = IframeFallbacks.createMemoryStorage();
      
      memoryStorage.setItem('test', 'value');
      expect(memoryStorage.getItem('test')).toBe('value');
      
      memoryStorage.removeItem('test');
      expect(memoryStorage.getItem('test')).toBeNull();
    });

    it('should create polling fallback for WebSocket', () => {
      const pollingFallback = IframeFallbacks.createPollingFallback('ws://localhost:3001');
      
      expect(pollingFallback.connect).toBeDefined();
      expect(pollingFallback.disconnect).toBeDefined();
      expect(pollingFallback.send).toBeDefined();
      expect(pollingFallback.addEventListener).toBeDefined();
    });

    it('should create notification fallback', () => {
      const notificationFallback = IframeFallbacks.createNotificationFallback();
      
      const notification = notificationFallback.show('Test', { body: 'Test body' });
      expect(notification).toBeDefined();
      expect(typeof notification.close).toBe('function');
    });

    it('should setup all fallbacks when restrictions detected', () => {
      const mockWindow = createMockWindow(true, {
        localStorage: false,
        webSocket: false,
        notifications: false,
        popups: false,
      });
      global.window = mockWindow as any;
      global.document = mockWindow.document as any;
      
      // Override global APIs to match the mocks
      const originalLocalStorage = global.localStorage;
      const originalSessionStorage = global.sessionStorage;
      global.localStorage = mockWindow.localStorage as any;
      global.sessionStorage = mockWindow.sessionStorage as any;

      const iframeInfo = getIframeInfo();
      const fallbacks = IframeFallbacks.setupFallbacks(iframeInfo);

      expect(fallbacks).toContain('localStorage');
      expect(fallbacks).toContain('Notification');
      expect(fallbacks).toContain('window.open');
      
      // Restore original APIs
      global.localStorage = originalLocalStorage;
      global.sessionStorage = originalSessionStorage;
    });
  });

  describe('Message Queue and Reliability', () => {
    it('should queue messages when not ready', async () => {
      const mockWindow = createMockWindow(true);
      global.window = mockWindow as any;

      const messenger = new IframeMessenger();
      
      // Send message before ready
      const result = await messenger.sendToParent({
        type: 'timer-update',
        data: { test: true },
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('queued');
    });

    it('should process queued messages after ready', () => {
      const mockWindow = createMockWindow(true);
      global.window = mockWindow as any;

      const messenger = new IframeMessenger();
      
      // Send message before ready (will be queued)
      messenger.sendToParentSync({
        type: 'timer-update',
        data: { test: true },
      });

      // Mark as ready and process queue
      messenger.notifyReady();

      // Should have sent both ready and queued messages
      expect(mockWindow.parent.postMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle postMessage errors gracefully', async () => {
      const mockWindow = createMockWindow(true);
      mockWindow.parent.postMessage = vi.fn().mockImplementation(() => {
        throw new Error('postMessage failed');
      });
      global.window = mockWindow as any;

      const messenger = new IframeMessenger();
      // Mark as ready to avoid queueing
      messenger.notifyReady();
      
      await expect(messenger.sendToParent({
        type: 'test',
        data: {},
      })).rejects.toThrow('postMessage failed');
    });

    it('should handle message handler errors', () => {
      const mockWindow = createMockWindow(true);
      global.window = mockWindow as any;

      const messenger = new IframeMessenger();
      const faultyHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      
      messenger.onMessage('test', faultyHandler);

      const messageEvent = {
        origin: 'https://app.gohighlevel.com',
        data: {
          type: 'test',
          payload: {},
          timestamp: Date.now(),
          source: 'parent-frame',
          version: '1.0.0',
        },
      };

      const messageListener = mockWindow.addEventListener.mock.calls
        .find(call => call[0] === 'message')?.[1];
      
      expect(() => {
        if (messageListener) {
          messageListener(messageEvent);
        }
      }).not.toThrow();

      expect(faultyHandler).toHaveBeenCalled();
    });
  });
});