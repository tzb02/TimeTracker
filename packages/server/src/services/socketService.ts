import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { getSessionManager } from './sessionManager';
import { getTimerService } from './timerService';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  organizationId?: string;
}

interface TimerEventData {
  userId: string;
  timerId?: string;
  projectId?: string;
  description?: string;
  startTime?: Date;
  elapsedTime?: number;
  isRunning: boolean;
}

interface SocketAuthPayload {
  userId: string;
  organizationId: string;
  iat: number;
  exp: number;
}

class SocketService {
  private io: SocketIOServer | null = null;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private socketUsers: Map<string, string> = new Map(); // socketId -> userId

  initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      // Iframe-friendly transport options
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as SocketAuthPayload;
        
        // For socket connections, we'll skip session validation since JWT is already verified
        // In production, you might want to implement a more sophisticated session check
        
        // Optional: Add session validation if you have a way to map userId to sessionId
        // const sessionManager = getSessionManager();
        // const session = await sessionManager.getSession(sessionId);
        // if (!session) {
        //   return next(new Error('Invalid session'));
        // }

        socket.userId = decoded.userId;
        socket.organizationId = decoded.organizationId;
        
        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;
    
    console.log(`Socket connected: ${socket.id} for user: ${userId}`);

    // Track user connections
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);
    this.socketUsers.set(socket.id, userId);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Send current timer state on connection
    this.sendCurrentTimerState(socket);

    // Handle timer events
    socket.on('timer:start', (data) => this.handleTimerStart(socket, data));
    socket.on('timer:stop', (data) => this.handleTimerStop(socket, data));
    socket.on('timer:pause', (data) => this.handleTimerPause(socket, data));
    socket.on('timer:sync', () => this.handleTimerSync(socket));

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    // Handle iframe-specific events
    socket.on('iframe:visibility', (data) => this.handleIframeVisibility(socket, data));
  }

  private async sendCurrentTimerState(socket: AuthenticatedSocket): Promise<void> {
    try {
      const timerService = getTimerService();
      const activeTimer = await timerService.getActiveTimer(socket.userId!);
      
      socket.emit('timer:state', {
        isRunning: !!activeTimer,
        timer: activeTimer || null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending timer state:', error);
      socket.emit('timer:error', { message: 'Failed to get timer state' });
    }
  }

  private async handleTimerStart(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const timerService = getTimerService();
      const timer = await timerService.startTimer(socket.userId!, {
        projectId: data.projectId,
        description: data.description
      });
      
      // Broadcast to all user's devices
      this.broadcastToUser(socket.userId!, 'timer:started', {
        timer,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error starting timer:', error);
      socket.emit('timer:error', { message: 'Failed to start timer' });
    }
  }

  private async handleTimerStop(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const timerService = getTimerService();
      const timeEntry = await timerService.stopTimer(socket.userId!, data.endTime ? { endTime: data.endTime } : undefined);
      
      // Broadcast to all user's devices
      this.broadcastToUser(socket.userId!, 'timer:stopped', {
        timeEntry,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error stopping timer:', error);
      socket.emit('timer:error', { message: 'Failed to stop timer' });
    }
  }

  private async handleTimerPause(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      const timerService = getTimerService();
      const timer = await timerService.pauseTimer(socket.userId!);
      
      // Broadcast to all user's devices
      this.broadcastToUser(socket.userId!, 'timer:paused', {
        timer,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error pausing timer:', error);
      socket.emit('timer:error', { message: 'Failed to pause timer' });
    }
  }

  private async handleTimerSync(socket: AuthenticatedSocket): Promise<void> {
    await this.sendCurrentTimerState(socket);
  }

  private handleIframeVisibility(socket: AuthenticatedSocket, data: { visible: boolean }): void {
    // Handle iframe visibility changes for optimization
    if (data.visible) {
      // Resume real-time updates
      this.sendCurrentTimerState(socket);
    }
    // When not visible, we can reduce update frequency
  }

  private handleDisconnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;
    
    console.log(`Socket disconnected: ${socket.id} for user: ${userId}`);

    // Clean up tracking
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.socketUsers.delete(socket.id);
  }

  // Public methods for broadcasting events
  broadcastToUser(userId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  broadcastTimerUpdate(userId: string, timerData: TimerEventData): void {
    this.broadcastToUser(userId, 'timer:update', {
      ...timerData,
      timestamp: new Date().toISOString()
    });
  }

  broadcastTimeEntryCreated(userId: string, timeEntry: any): void {
    this.broadcastToUser(userId, 'timeEntry:created', {
      timeEntry,
      timestamp: new Date().toISOString()
    });
  }

  broadcastTimeEntryUpdated(userId: string, timeEntry: any): void {
    this.broadcastToUser(userId, 'timeEntry:updated', {
      timeEntry,
      timestamp: new Date().toISOString()
    });
  }

  broadcastTimeEntryDeleted(userId: string, timeEntryId: string): void {
    this.broadcastToUser(userId, 'timeEntry:deleted', {
      timeEntryId,
      timestamp: new Date().toISOString()
    });
  }

  // Get connection stats
  getConnectionStats(): { totalConnections: number; uniqueUsers: number } {
    return {
      totalConnections: this.socketUsers.size,
      uniqueUsers: this.userSockets.size
    };
  }

  // Check if user is connected
  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  // Get connected socket count for user
  getUserConnectionCount(userId: string): number {
    return this.userSockets.get(userId)?.size || 0;
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    if (this.io) {
      console.log('Shutting down Socket.io server...');
      this.io.close();
      this.userSockets.clear();
      this.socketUsers.clear();
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

export function initializeSocketService(server: HTTPServer): SocketService {
  const service = getSocketService();
  service.initialize(server);
  return service;
}

export { SocketService, TimerEventData, AuthenticatedSocket };