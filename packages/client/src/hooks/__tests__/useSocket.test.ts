import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSocket, useSocketStatus } from '../useSocket';
import { getSocketService } from '../../services/socketService';

// Mock the socket service
vi.mock('../../services/socketService', () => ({
  getSocketService: vi.fn()
}));

// Mock auth context and API
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true
  }))
}));

vi.mock('../../lib/api', () => ({
  getTokens: () => ({
    accessToken: 'mock-token'
  })
}));

describe('useSocket', () => {
  let mockSocketService: any;

  beforeEach(() => {
    mockSocketService = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      reconnect: vi.fn(),
      setHandlers: vi.fn(),
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
      pauseTimer: vi.fn(),
      syncTimer: vi.fn(),
      handleVisibilityChange: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
      isPolling: vi.fn().mockReturnValue(false),
      getConnectionType: vi.fn().mockReturnValue('disconnected')
    };

    (getSocketService as any).mockReturnValue(mockSocketService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should auto-connect when authenticated', () => {
      renderHook(() => useSocket());

      expect(mockSocketService.connect).toHaveBeenCalledWith('mock-token');
    });

    it('should not auto-connect when autoConnect is false', () => {
      renderHook(() => useSocket({ autoConnect: false }));

      expect(mockSocketService.connect).not.toHaveBeenCalled();
    });

    it('should disconnect when not authenticated', () => {
      const { useAuth } = require('../../contexts/AuthContext');
      useAuth.mockReturnValue({
        isAuthenticated: false
      });

      renderHook(() => useSocket());

      expect(mockSocketService.disconnect).toHaveBeenCalled();
    });

    it('should provide connection methods', () => {
      const { result } = renderHook(() => useSocket());

      expect(typeof result.current.connect).toBe('function');
      expect(typeof result.current.disconnect).toBe('function');
      expect(typeof result.current.reconnect).toBe('function');
    });

    it('should call socket service methods', () => {
      const { result } = renderHook(() => useSocket());

      act(() => {
        result.current.connect();
        result.current.disconnect();
        result.current.reconnect();
      });

      expect(mockSocketService.connect).toHaveBeenCalledWith('mock-token');
      expect(mockSocketService.disconnect).toHaveBeenCalled();
      expect(mockSocketService.reconnect).toHaveBeenCalled();
    });
  });

  describe('Event Handlers', () => {
    it('should register event handlers', () => {
      const handlers = {
        onTimerStarted: vi.fn(),
        onTimerStopped: vi.fn(),
        onConnect: vi.fn()
      };

      renderHook(() => useSocket(handlers));

      expect(mockSocketService.setHandlers).toHaveBeenCalledWith(
        expect.objectContaining({
          onTimerStarted: handlers.onTimerStarted,
          onTimerStopped: handlers.onTimerStopped,
          onConnect: handlers.onConnect
        })
      );
    });

    it('should update handlers when options change', () => {
      const initialHandlers = {
        onTimerStarted: jest.fn()
      };

      const { rerender } = renderHook(
        (props) => useSocket(props),
        { initialProps: initialHandlers }
      );

      const newHandlers = {
        onTimerStarted: vi.fn(),
        onTimerStopped: vi.fn()
      };

      rerender(newHandlers);

      expect(mockSocketService.setHandlers).toHaveBeenCalledWith(
        expect.objectContaining({
          onTimerStarted: newHandlers.onTimerStarted,
          onTimerStopped: newHandlers.onTimerStopped
        })
      );
    });
  });

  describe('Timer Controls', () => {
    it('should provide timer control methods', () => {
      const { result } = renderHook(() => useSocket());

      expect(typeof result.current.startTimer).toBe('function');
      expect(typeof result.current.stopTimer).toBe('function');
      expect(typeof result.current.pauseTimer).toBe('function');
      expect(typeof result.current.syncTimer).toBe('function');
    });

    it('should call socket service timer methods', () => {
      const { result } = renderHook(() => useSocket());

      act(() => {
        result.current.startTimer('project-1', 'Test task');
        result.current.stopTimer();
        result.current.pauseTimer();
        result.current.syncTimer();
      });

      expect(mockSocketService.startTimer).toHaveBeenCalledWith('project-1', 'Test task');
      expect(mockSocketService.stopTimer).toHaveBeenCalled();
      expect(mockSocketService.pauseTimer).toHaveBeenCalled();
      expect(mockSocketService.syncTimer).toHaveBeenCalled();
    });
  });

  describe('Connection Status', () => {
    it('should return connection status', () => {
      mockSocketService.isConnected.mockReturnValue(true);
      mockSocketService.isPolling.mockReturnValue(false);
      mockSocketService.getConnectionType.mockReturnValue('websocket');

      const { result } = renderHook(() => useSocket());

      expect(result.current.isConnected).toBe(true);
      expect(result.current.isPolling).toBe(false);
      expect(result.current.connectionType).toBe('websocket');
    });
  });

  describe('Visibility Handling', () => {
    beforeEach(() => {
      // Mock document.addEventListener
      vi.spyOn(document, 'addEventListener');
      vi.spyOn(document, 'removeEventListener');
      vi.spyOn(window, 'addEventListener');
      vi.spyOn(window, 'removeEventListener');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should register visibility change listeners', () => {
      renderHook(() => useSocket());

      expect(document.addEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );
      expect(window.addEventListener).toHaveBeenCalledWith(
        'focus',
        expect.any(Function)
      );
      expect(window.addEventListener).toHaveBeenCalledWith(
        'blur',
        expect.any(Function)
      );
    });

    it('should cleanup listeners on unmount', () => {
      const { unmount } = renderHook(() => useSocket());

      unmount();

      expect(document.removeEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );
      expect(window.removeEventListener).toHaveBeenCalledWith(
        'focus',
        expect.any(Function)
      );
      expect(window.removeEventListener).toHaveBeenCalledWith(
        'blur',
        expect.any(Function)
      );
    });

    it('should handle visibility changes', () => {
      renderHook(() => useSocket());

      // Simulate visibility change
      Object.defineProperty(document, 'hidden', {
        value: false,
        writable: true
      });

      const visibilityHandler = (document.addEventListener as any).mock.calls
        .find(call => call[0] === 'visibilitychange')[1];

      act(() => {
        visibilityHandler();
      });

      expect(mockSocketService.handleVisibilityChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Cleanup', () => {
    it('should disconnect on unmount', () => {
      const { unmount } = renderHook(() => useSocket());

      unmount();

      expect(mockSocketService.disconnect).toHaveBeenCalled();
    });
  });
});

describe('useSocketStatus', () => {
  let mockSocketService: any;

  beforeEach(() => {
    mockSocketService = {
      isConnected: jest.fn().mockReturnValue(true),
      isPolling: jest.fn().mockReturnValue(false),
      getConnectionType: jest.fn().mockReturnValue('websocket')
    };

    (getSocketService as any).mockReturnValue(mockSocketService);
  });

  it('should return connection status', () => {
    const { result } = renderHook(() => useSocketStatus());

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isPolling).toBe(false);
    expect(result.current.connectionType).toBe('websocket');
  });

  it('should call socket service status methods', () => {
    renderHook(() => useSocketStatus());

    expect(mockSocketService.isConnected).toHaveBeenCalled();
    expect(mockSocketService.isPolling).toHaveBeenCalled();
    expect(mockSocketService.getConnectionType).toHaveBeenCalled();
  });
});