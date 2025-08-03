import { io, Socket } from 'socket.io-client';
import { getTokens } from '../lib/api';

interface TimerEventData {
  userId: string;
  timerId?: string;
  projectId?: string;
  description?: string;
  startTime?: Date;
  elapsedTime?: number;
  isRunning: boolean;
  timestamp: string;
}

interface TimeEntryEventData {
  timeEntry: any;
  timestamp: string;
}

interface SocketEventHandlers {
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
}

class SocketService {
  private socket: Socket | null = null;
  private handlers: SocketEventHandlers = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isIframe = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private pollingEnabled = false;

  constructor() {
    // Detect if running in iframe
    this.isIframe = window !== window.parent;
  }

  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    // Socket.io configuration optimized for iframe
    this.socket = io(serverUrl, {
      auth: {
        token
      },
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: false,
      timeout: 20000,
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      // maxHttpBufferSize: 1e6, // Not available in this version
      // Iframe-specific optimizations
      withCredentials: true,
      extraHeaders: this.isIframe ? {
        'X-Iframe-Request': 'true'
      } : {}
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.reconnectAttempts = 0;
      this.stopPolling(); // Stop polling when socket connects
      this.handlers.onConnect?.();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.handlers.onDisconnect?.();
      
      // Start polling fallback if in iframe and disconnect was unexpected
      if (this.isIframe && reason === 'transport close') {
        this.startPolling();
      }
    });

    this.socket.on('reconnect', () => {
      console.log('Socket reconnected');
      this.stopPolling(); // Stop polling when reconnected
      this.handlers.onReconnect?.();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;
      
      // If socket fails in iframe, fallback to polling
      if (this.isIframe && this.reconnectAttempts >= 2) {
        this.startPolling();
      }
    });

    // Timer events
    this.socket.on('timer:update', (data: TimerEventData) => {
      this.handlers.onTimerUpdate?.(data);
    });

    this.socket.on('timer:started', (data: TimerEventData) => {
      this.handlers.onTimerStarted?.(data);
    });

    this.socket.on('timer:stopped', (data: TimerEventData) => {
      this.handlers.onTimerStopped?.(data);
    });

    this.socket.on('timer:paused', (data: TimerEventData) => {
      this.handlers.onTimerPaused?.(data);
    });

    this.socket.on('timer:state', (data: { isRunning: boolean; timer: any; timestamp: string }) => {
      this.handlers.onTimerState?.(data);
    });

    this.socket.on('timer:error', (error: { message: string }) => {
      this.handlers.onError?.(error);
    });

    // Time entry events
    this.socket.on('timeEntry:created', (data: TimeEntryEventData) => {
      this.handlers.onTimeEntryCreated?.(data);
    });

    this.socket.on('timeEntry:updated', (data: TimeEntryEventData) => {
      this.handlers.onTimeEntryUpdated?.(data);
    });

    this.socket.on('timeEntry:deleted', (data: { timeEntryId: string; timestamp: string }) => {
      this.handlers.onTimeEntryDeleted?.(data);
    });
  }

  // Polling fallback for iframe restrictions
  private startPolling(): void {
    if (this.pollingEnabled || this.pollingInterval) {
      return;
    }

    console.log('Starting polling fallback for iframe');
    this.pollingEnabled = true;

    this.pollingInterval = setInterval(async () => {
      try {
        // Poll timer state
        const response = await fetch('/api/timers/active', {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${getTokens().accessToken}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          this.handlers.onTimerState?.({
            isRunning: !!data.data,
            timer: data.data,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.pollingEnabled = false;
      console.log('Stopped polling fallback');
    }
  }

  // Event handler registration
  setHandlers(handlers: SocketEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  // Timer control methods
  startTimer(projectId: string, description?: string): void {
    if (this.socket?.connected) {
      this.socket.emit('timer:start', { projectId, description });
    }
  }

  stopTimer(): void {
    if (this.socket?.connected) {
      this.socket.emit('timer:stop', {});
    }
  }

  pauseTimer(): void {
    if (this.socket?.connected) {
      this.socket.emit('timer:pause', {});
    }
  }

  syncTimer(): void {
    if (this.socket?.connected) {
      this.socket.emit('timer:sync');
    }
  }

  // Iframe visibility handling
  handleVisibilityChange(visible: boolean): void {
    if (this.socket?.connected) {
      this.socket.emit('iframe:visibility', { visible });
    }
    
    // Adjust polling frequency based on visibility
    if (this.pollingEnabled) {
      this.stopPolling();
      if (visible) {
        this.startPolling();
      }
    }
  }

  // Connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  isPolling(): boolean {
    return this.pollingEnabled;
  }

  getConnectionType(): 'websocket' | 'polling' | 'disconnected' {
    if (this.socket?.connected) {
      return this.socket.io.engine.transport.name as 'websocket' | 'polling';
    }
    if (this.pollingEnabled) {
      return 'polling';
    }
    return 'disconnected';
  }

  // Cleanup
  disconnect(): void {
    this.stopPolling();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.handlers = {};
    this.reconnectAttempts = 0;
  }

  // Force reconnection
  reconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.connect();
    }
  }
}

// Singleton instance
let socketService: SocketService | null = null;

export function getSocketService(): SocketService {
  if (!socketService) {
    socketService = new SocketService();
  }
  return socketService;
}

export { SocketService };
export type { TimerEventData, TimeEntryEventData, SocketEventHandlers };