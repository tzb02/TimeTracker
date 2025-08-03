import { useEffect, useRef, useCallback } from 'react';
import { getSocketService, SocketEventHandlers, TimerEventData, TimeEntryEventData } from '../services/socketService';
import { useAuth } from '../contexts/AuthContext';
import { getTokens } from '../lib/api';

interface UseSocketOptions {
  onTimerUpdate?: (data: TimerEventData) => void;
  onTimerStarted?: (data: TimerEventData) => void;
  onTimerStopped?: (data: TimerEventData) => void;
  onTimerPaused?: (data: TimerEventData) => void;
  onTimerState?: (data: { isRunning: boolean; timer: any; timestamp: string }) => void;
  onTimeEntryCreated?: (data: TimeEntryEventData) => void;
  onTimeEntryUpdated?: (data: TimeEntryEventData) => void;
  onTimeEntryDeleted?: (data: { timeEntryId: string; timestamp: string }) => void;
  onError?: (error: { message: string }) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
  autoConnect?: boolean;
}

interface UseSocketReturn {
  isConnected: boolean;
  isPolling: boolean;
  connectionType: 'websocket' | 'polling' | 'disconnected';
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  startTimer: (projectId: string, description?: string) => void;
  stopTimer: () => void;
  pauseTimer: () => void;
  syncTimer: () => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { isAuthenticated } = useAuth();
  const socketService = useRef(getSocketService());
  const handlersRef = useRef<SocketEventHandlers>({});

  // Update handlers ref when options change
  useEffect(() => {
    handlersRef.current = {
      onTimerUpdate: options.onTimerUpdate,
      onTimerStarted: options.onTimerStarted,
      onTimerStopped: options.onTimerStopped,
      onTimerPaused: options.onTimerPaused,
      onTimerState: options.onTimerState,
      onTimeEntryCreated: options.onTimeEntryCreated,
      onTimeEntryUpdated: options.onTimeEntryUpdated,
      onTimeEntryDeleted: options.onTimeEntryDeleted,
      onError: options.onError,
      onConnect: options.onConnect,
      onDisconnect: options.onDisconnect,
      onReconnect: options.onReconnect,
    };
    
    socketService.current.setHandlers(handlersRef.current);
  }, [
    options.onTimerUpdate,
    options.onTimerStarted,
    options.onTimerStopped,
    options.onTimerPaused,
    options.onTimerState,
    options.onTimeEntryCreated,
    options.onTimeEntryUpdated,
    options.onTimeEntryDeleted,
    options.onError,
    options.onConnect,
    options.onDisconnect,
    options.onReconnect,
  ]);

  // Auto-connect when authenticated
  useEffect(() => {
    const token = getTokens().accessToken;
    if (isAuthenticated && token && (options.autoConnect !== false)) {
      socketService.current.connect(token);
    } else if (!isAuthenticated) {
      socketService.current.disconnect();
    }
  }, [isAuthenticated, options.autoConnect]);

  // Handle iframe visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      socketService.current.handleVisibilityChange(isVisible);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also handle iframe focus/blur
    const handleFocus = () => socketService.current.handleVisibilityChange(true);
    const handleBlur = () => socketService.current.handleVisibilityChange(false);
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socketService.current.disconnect();
    };
  }, []);

  // Connection methods
  const connect = useCallback(() => {
    const token = getTokens().accessToken;
    if (token) {
      socketService.current.connect(token);
    }
  }, []);

  const disconnect = useCallback(() => {
    socketService.current.disconnect();
  }, []);

  const reconnect = useCallback(() => {
    socketService.current.reconnect();
  }, []);

  // Timer control methods
  const startTimer = useCallback((projectId: string, description?: string) => {
    socketService.current.startTimer(projectId, description);
  }, []);

  const stopTimer = useCallback(() => {
    socketService.current.stopTimer();
  }, []);

  const pauseTimer = useCallback(() => {
    socketService.current.pauseTimer();
  }, []);

  const syncTimer = useCallback(() => {
    socketService.current.syncTimer();
  }, []);

  return {
    isConnected: socketService.current.isConnected(),
    isPolling: socketService.current.isPolling(),
    connectionType: socketService.current.getConnectionType(),
    connect,
    disconnect,
    reconnect,
    startTimer,
    stopTimer,
    pauseTimer,
    syncTimer,
  };
}

// Hook for connection status only (lightweight)
export function useSocketStatus() {
  const socketService = useRef(getSocketService());
  
  return {
    isConnected: socketService.current.isConnected(),
    isPolling: socketService.current.isPolling(),
    connectionType: socketService.current.getConnectionType(),
  };
}