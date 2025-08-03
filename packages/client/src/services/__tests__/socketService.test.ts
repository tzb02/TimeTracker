import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getSocketService, SocketService } from '../socketService';
import { io } from 'socket.io-client';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn()
}));

// Mock auth API
vi.mock('../../lib/api', () => ({
  getTokens: () => ({
    accessToken: 'mock-token'
  })
}));

// Mock fetch for polling fallback
global.fetch = vi.fn();

describe('SocketService', () => {
  let socketService: SocketService;
  let mockSocket: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock socket
    mockSocket = {
      connected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
      io: {
        engine: {
          transport: {
            name: 'websocket'
          }
        }
      }
    };

    (io as any).mockReturnValue(mockSocket);
    
    // Get fresh instance
    socketService = getSocketService();
  });

  afterEach(() => {
    socketService.disconnect();
  });

  describe('Connection Management', () => {
    it('should create socket connection with correct configuration', () => {
      const token = 'test-token';
      socketService.connect(token);

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          auth: { token },
          transports: ['websocket', 'polling'],
          upgrade: true,
          rememberUpgrade: false,
          timeout: 20000,
          forceNew: false,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          maxHttpBufferSize: 1e6,
          withCredentials: true
        })
      );
    });

    it('should not create duplicate connections', () => {
      mockSocket.connected = true;
      const token = 'test-token';
      
      socketService.connect(token);
      socketService.connect(token);

      expect(io).toHaveBeenCalledTimes(1);
    });

    it('should detect iframe environment', () => {
      // Mock iframe environment
      Object.defineProperty(window, 'parent', {
        value: {},
        writable: true
      });

      const newService = new SocketService();
      newService.connect('test-token');

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          extraHeaders: {
            'X-Iframe-Request': 'true'
          }
        })
      );
    });

    it('should return correct connection status', () => {
      expect(socketService.isConnected()).toBe(false);
      
      mockSocket.connected = true;
      expect(socketService.isConnected()).toBe(true);
    });

    it('should return correct connection type', () => {
      expect(socketService.getConnectionType()).toBe('disconnected');
      
      mockSocket.connected = true;
      expect(socketService.getConnectionType()).toBe('websocket');
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      socketService.connect('test-token');
    });

    it('should register event handlers', () => {
      const handlers = {
        onTimerUpdate: vi.fn(),
        onTimerStarted: vi.fn(),
        onConnect: vi.fn()
      };

      socketService.setHandlers(handlers);

      // Verify socket event listeners were registered
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('timer:update', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('timer:started', expect.any(Function));
    });

    it('should handle timer events', () => {
      const onTimerStarted = vi.fn();
      socketService.setHandlers({ onTimerStarted });

      // Simulate timer started event
      const timerData = {
        userId: 'user-1',
        timerId: 'timer-1',
        projectId: 'project-1',
        description: 'Test task',
        startTime: new Date(),
        elapsedTime: 0,
        isRunning: true,
        timestamp: new Date().toISOString()
      };

      // Find and call the timer:started handler
      const timerStartedCall = mockSocket.on.mock.calls.find(
        call => call[0] === 'timer:started'
      );
      expect(timerStartedCall).toBeDefined();
      
      timerStartedCall[1](timerData);
      expect(onTimerStarted).toHaveBeenCalledWith(timerData);
    });

    it('should handle connection events', () => {
      const onConnect = vi.fn();
      const onDisconnect = vi.fn();
      
      socketService.setHandlers({ onConnect, onDisconnect });

      // Find and call the connect handler
      const connectCall = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      );
      expect(connectCall).toBeDefined();
      connectCall[1]();
      expect(onConnect).toHaveBeenCalled();

      // Find and call the disconnect handler
      const disconnectCall = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      );
      expect(disconnectCall).toBeDefined();
      disconnectCall[1]('transport close');
      expect(onDisconnect).toHaveBeenCalled();
    });
  });

  describe('Timer Controls', () => {
    beforeEach(() => {
      mockSocket.connected = true;
      socketService.connect('test-token');
    });

    it('should emit timer start event', () => {
      socketService.startTimer('project-1', 'Test task');
      
      expect(mockSocket.emit).toHaveBeenCalledWith('timer:start', {
        projectId: 'project-1',
        description: 'Test task'
      });
    });

    it('should emit timer stop event', () => {
      socketService.stopTimer();
      
      expect(mockSocket.emit).toHaveBeenCalledWith('timer:stop', {});
    });

    it('should emit timer pause event', () => {
      socketService.pauseTimer();
      
      expect(mockSocket.emit).toHaveBeenCalledWith('timer:pause', {});
    });

    it('should emit timer sync event', () => {
      socketService.syncTimer();
      
      expect(mockSocket.emit).toHaveBeenCalledWith('timer:sync');
    });

    it('should not emit events when disconnected', () => {
      mockSocket.connected = false;
      
      socketService.startTimer('project-1', 'Test task');
      socketService.stopTimer();
      socketService.pauseTimer();
      socketService.syncTimer();
      
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('Polling Fallback', () => {
    beforeEach(() => {
      // Mock iframe environment
      Object.defineProperty(window, 'parent', {
        value: {},
        writable: true
      });
      
      socketService = new SocketService();
      socketService.connect('test-token');
    });

    it('should start polling on connection error in iframe', () => {
      vi.useFakeTimers();
      
      // Mock successful fetch response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: {
            id: 'timer-1',
            projectId: 'project-1',
            isRunning: true
          }
        })
      });

      const onTimerState = vi.fn();
      socketService.setHandlers({ onTimerState });

      // Simulate connection error in iframe
      const connectErrorCall = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect_error'
      );
      expect(connectErrorCall).toBeDefined();
      
      // Trigger multiple connection errors to start polling
      connectErrorCall[1](new Error('Connection failed'));
      connectErrorCall[1](new Error('Connection failed'));

      expect(socketService.isPolling()).toBe(true);

      // Fast-forward timer to trigger polling
      vi.advanceTimersByTime(5000);

      expect(global.fetch).toHaveBeenCalledWith('/api/timers/active', {
        credentials: 'include',
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      });

      vi.useRealTimers();
    });

    it('should stop polling when socket connects', () => {
      vi.useFakeTimers();
      
      // Start polling
      const disconnectCall = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      );
      expect(disconnectCall).toBeDefined();
      disconnectCall[1]('transport close');

      expect(socketService.isPolling()).toBe(true);

      // Simulate reconnection
      const connectCall = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      );
      expect(connectCall).toBeDefined();
      connectCall[1]();

      expect(socketService.isPolling()).toBe(false);

      vi.useRealTimers();
    });

    it('should handle polling errors gracefully', () => {
      vi.useFakeTimers();
      
      // Mock fetch error
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      // Start polling
      const disconnectCall = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      );
      expect(disconnectCall).toBeDefined();
      disconnectCall[1]('transport close');

      // Should not throw error
      expect(() => {
        vi.advanceTimersByTime(5000);
      }).not.toThrow();

      vi.useRealTimers();
    });
  });

  describe('Visibility Handling', () => {
    beforeEach(() => {
      mockSocket.connected = true;
      socketService.connect('test-token');
    });

    it('should emit visibility change events', () => {
      socketService.handleVisibilityChange(true);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('iframe:visibility', {
        visible: true
      });
    });

    it('should adjust polling based on visibility', () => {
      vi.useFakeTimers();
      
      // Start polling
      const disconnectCall = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      );
      disconnectCall[1]('transport close');

      expect(socketService.isPolling()).toBe(true);

      // Hide iframe
      socketService.handleVisibilityChange(false);
      expect(socketService.isPolling()).toBe(false);

      // Show iframe
      socketService.handleVisibilityChange(true);
      expect(socketService.isPolling()).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('Cleanup', () => {
    it('should disconnect socket and clear handlers', () => {
      socketService.connect('test-token');
      socketService.setHandlers({ onConnect: vi.fn() });
      
      socketService.disconnect();
      
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(socketService.isConnected()).toBe(false);
    });

    it('should force reconnection', () => {
      mockSocket.connected = true;
      socketService.connect('test-token');
      
      socketService.reconnect();
      
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(mockSocket.connect).toHaveBeenCalled();
    });
  });
});