import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  detectIframe, 
  getIframeInfo, 
  IframeMessenger, 
  IframeFallbacks 
} from '../iframe';

// Mock window object
const createMockWindow = () => ({
  self: {},
  top: {},
  parent: {
    postMessage: vi.fn(),
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  innerWidth: 800,
  innerHeight: 600,
  localStorage: {
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  sessionStorage: {
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  WebSocket: vi.fn(),
  Notification: {
    permission: 'granted',
  },
});

// Mock document object
const mockDocument = {
  referrer: 'https://app.gohighlevel.com',
};

describe('iframe utilities', () => {
  let mockWindow: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWindow = createMockWindow();
    
    // Reset window mocks
    Object.defineProperty(global, 'window', {
      value: mockWindow,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'document', {
      value: mockDocument,
      writable: true,
      configurable: true,
    });
    
    // Mock Notification globally
    global.Notification = {
      permission: 'granted',
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectIframe', () => {
    it('should detect when running in iframe', () => {
      // Mock iframe scenario where window.self !== window.top
      const selfWindow = {};
      const topWindow = {};
      
      Object.defineProperty(global.window, 'self', {
        value: selfWindow,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global.window, 'top', {
        value: topWindow,
        writable: true,
        configurable: true,
      });
      
      const result = detectIframe();
      expect(result).toBe(true);
    });

    it('should detect when not running in iframe', () => {
      // Mock non-iframe scenario where window.self === window.top
      const sameWindow = {};
      
      Object.defineProperty(global.window, 'self', {
        value: sameWindow,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global.window, 'top', {
        value: sameWindow,
        writable: true,
        configurable: true,
      });
      
      const result = detectIframe();
      expect(result).toBe(false);
    });

    it('should detect iframe when cross-origin access is blocked', () => {
      // Mock cross-origin scenario where accessing window.top throws error
      Object.defineProperty(global.window, 'top', {
        get: () => {
          throw new Error('Blocked by CORS');
        },
        configurable: true,
      });
      
      const result = detectIframe();
      expect(result).toBe(true);
    });
  });

  describe('getIframeInfo', () => {
    beforeEach(() => {
      // Mock successful storage tests
      mockWindow.localStorage.setItem.mockImplementation(() => {});
      mockWindow.localStorage.removeItem.mockImplementation(() => {});
      mockWindow.sessionStorage.setItem.mockImplementation(() => {});
      mockWindow.sessionStorage.removeItem.mockImplementation(() => {});
      
      // Mock WebSocket constructor
      mockWindow.WebSocket.mockImplementation(() => ({
        close: vi.fn(),
      }));
    });

    it('should return comprehensive iframe information', () => {
      // Setup iframe scenario
      const selfWindow = {};
      const topWindow = {};
      
      Object.defineProperty(global.window, 'self', {
        value: selfWindow,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global.window, 'top', {
        value: topWindow,
        writable: true,
        configurable: true,
      });
      
      const info = getIframeInfo();
      
      expect(info).toEqual({
        isInIframe: true,
        parentOrigin: 'https://app.gohighlevel.com',
        dimensions: {
          width: 800,
          height: 600,
        },
        restrictions: {
          localStorage: true,
          sessionStorage: true,
          webSocket: true,
          notifications: true,
        },
      });
    });

    it('should detect storage restrictions', () => {
      // Mock localStorage blocked
      mockWindow.localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage blocked');
      });
      
      const info = getIframeInfo();
      expect(info.restrictions.localStorage).toBe(false);
    });

    it('should detect WebSocket restrictions', () => {
      // Mock WebSocket blocked
      mockWindow.WebSocket.mockImplementation(() => {
        throw new Error('WebSocket blocked');
      });
      
      const info = getIframeInfo();
      expect(info.restrictions.webSocket).toBe(false);
    });

    it('should detect notification restrictions', () => {
      // Mock notifications denied
      mockWindow.Notification.permission = 'denied';
      
      const info = getIframeInfo();
      expect(info.restrictions.notifications).toBe(false);
    });
  });

  describe('IframeMessenger', () => {
    let messenger: IframeMessenger;

    beforeEach(() => {
      messenger = new IframeMessenger();
    });

    describe('sendToParent', () => {
      it('should send message to parent frame when in iframe', () => {
        // Mock iframe scenario
        const selfWindow = {};
        const topWindow = {};
        
        Object.defineProperty(global.window, 'self', {
          value: selfWindow,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(global.window, 'top', {
          value: topWindow,
          writable: true,
          configurable: true,
        });
        
        messenger.sendToParent({
          type: 'timer-update',
          data: { isRunning: true },
        });

        expect(mockWindow.parent.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'timer-update',
            payload: { isRunning: true },
            source: 'time-tracker',
            timestamp: expect.any(Number),
          }),
          '*'
        );
      });

      it('should not send message when not in iframe', () => {
        // Mock non-iframe scenario
        const sameWindow = {};
        
        Object.defineProperty(global.window, 'self', {
          value: sameWindow,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(global.window, 'top', {
          value: sameWindow,
          writable: true,
          configurable: true,
        });
        
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        messenger.sendToParent({
          type: 'timer-update',
          data: { isRunning: true },
        });

        expect(mockWindow.parent.postMessage).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith('Not in iframe, cannot send message to parent');
        
        consoleSpy.mockRestore();
      });
    });

    describe('message handling', () => {
      it('should register and call message handlers', () => {
        const handler = vi.fn();
        messenger.onMessage('test-message', handler);

        // Simulate receiving a message
        const messageEvent = {
          origin: 'https://app.gohighlevel.com',
          data: {
            type: 'test-message',
            payload: { test: 'data' },
            timestamp: Date.now(),
            source: 'time-tracker',
          },
        };

        // Trigger the message event
        const messageListener = mockWindow.addEventListener.mock.calls.find(
          call => call[0] === 'message'
        )?.[1];
        
        if (messageListener) {
          messageListener(messageEvent);
        }

        expect(handler).toHaveBeenCalledWith({ test: 'data' });
      });

      it('should ignore messages from unauthorized origins', () => {
        const handler = vi.fn();
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        messenger.onMessage('test-message', handler);

        // Simulate receiving a message from unauthorized origin
        const messageEvent = {
          origin: 'https://malicious-site.com',
          data: {
            type: 'test-message',
            payload: { test: 'data' },
            timestamp: Date.now(),
            source: 'time-tracker',
          },
        };

        const messageListener = mockWindow.addEventListener.mock.calls.find(
          call => call[0] === 'message'
        )?.[1];
        
        if (messageListener) {
          messageListener(messageEvent);
        }

        expect(handler).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
          'Received message from unauthorized origin:',
          'https://malicious-site.com'
        );
        
        consoleSpy.mockRestore();
      });

      it('should ignore invalid message formats', () => {
        const handler = vi.fn();
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        messenger.onMessage('test-message', handler);

        // Simulate receiving an invalid message
        const messageEvent = {
          origin: 'https://app.gohighlevel.com',
          data: {
            // Missing required fields
            type: 'test-message',
          },
        };

        const messageListener = mockWindow.addEventListener.mock.calls.find(
          call => call[0] === 'message'
        )?.[1];
        
        if (messageListener) {
          messageListener(messageEvent);
        }

        expect(handler).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
          'Received invalid message format:',
          messageEvent.data
        );
        
        consoleSpy.mockRestore();
      });
    });

    describe('convenience methods', () => {
      it('should send ready notification', () => {
        messenger.notifyReady();

        expect(mockWindow.parent.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'ready',
            payload: expect.objectContaining({
              version: '1.0.0',
              capabilities: expect.any(Object),
            }),
          }),
          '*'
        );
      });

      it('should send resize request', () => {
        messenger.requestResize(400, 300);

        expect(mockWindow.parent.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'resize',
            payload: { width: 400, height: 300 },
          }),
          '*'
        );
      });

      it('should send timer update', () => {
        const timerData = { isRunning: true, elapsedTime: 120 };
        messenger.notifyTimerUpdate(timerData);

        expect(mockWindow.parent.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'timer-update',
            payload: timerData,
          }),
          '*'
        );
      });

      it('should send error notification', () => {
        messenger.notifyError('Test error', { code: 500 });

        expect(mockWindow.parent.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            payload: { error: 'Test error', details: { code: 500 } },
          }),
          '*'
        );
      });

      it('should send general notification', () => {
        messenger.notify('Test message', 'success');

        expect(mockWindow.parent.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'notification',
            payload: { message: 'Test message', type: 'success' },
          }),
          '*'
        );
      });
    });
  });

  describe('IframeFallbacks', () => {
    describe('createMemoryStorage', () => {
      it('should create a functional storage fallback', () => {
        const storage = IframeFallbacks.createMemoryStorage();

        storage.setItem('test', 'value');
        expect(storage.getItem('test')).toBe('value');
        expect(storage.length).toBe(1);

        storage.removeItem('test');
        expect(storage.getItem('test')).toBeNull();
        expect(storage.length).toBe(0);

        storage.setItem('key1', 'value1');
        storage.setItem('key2', 'value2');
        expect(storage.key(0)).toBe('key1');
        expect(storage.key(1)).toBe('key2');

        storage.clear();
        expect(storage.length).toBe(0);
      });
    });

    describe('createPollingFallback', () => {
      it('should create a polling fallback with event handling', () => {
        const fallback = IframeFallbacks.createPollingFallback('ws://localhost:3001', 1000);

        const messageHandler = vi.fn();
        const openHandler = vi.fn();
        const closeHandler = vi.fn();

        fallback.addEventListener('message', messageHandler);
        fallback.addEventListener('open', openHandler);
        fallback.addEventListener('close', closeHandler);

        fallback.connect();
        expect(openHandler).toHaveBeenCalled();

        fallback.disconnect();
        expect(closeHandler).toHaveBeenCalled();
      });
    });

    describe('createNotificationFallback', () => {
      it('should create a notification fallback', () => {
        const fallback = IframeFallbacks.createNotificationFallback();

        expect(fallback.requestPermission()).resolves.toBe('granted');
        
        // Test that show method doesn't throw
        expect(() => {
          fallback.show('Test title', { body: 'Test body' });
        }).not.toThrow();
      });
    });
  });
});