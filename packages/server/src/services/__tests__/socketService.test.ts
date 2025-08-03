import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { SocketService, getSocketService, initializeSocketService } from '../socketService';

// Mock dependencies
jest.mock('../sessionManager', () => ({
  getSessionManager: () => ({
    getSession: jest.fn().mockResolvedValue({ userId: 'test-user-id' })
  })
}));

jest.mock('../timerService', () => ({
  getTimerService: () => ({
    getActiveTimer: jest.fn().mockResolvedValue(null),
    startTimer: jest.fn().mockResolvedValue({
      id: 'timer-1',
      userId: 'test-user-id',
      projectId: 'project-1',
      description: 'Test task',
      startTime: new Date(),
      isRunning: true
    }),
    stopTimer: jest.fn().mockResolvedValue({
      id: 'timer-1',
      userId: 'test-user-id',
      projectId: 'project-1',
      description: 'Test task',
      startTime: new Date(Date.now() - 60000),
      endTime: new Date(),
      duration: 60,
      isRunning: false
    }),
    pauseTimer: jest.fn().mockResolvedValue({
      id: 'timer-1',
      userId: 'test-user-id',
      projectId: 'project-1',
      description: 'Test task',
      startTime: new Date(Date.now() - 30000),
      endTime: new Date(),
      duration: 30,
      isRunning: false
    })
  })
}));

describe('SocketService', () => {
  let httpServer: HTTPServer;
  let socketService: SocketService;
  let serverSocket: SocketIOServer;
  let clientSocket: ClientSocket;
  let port: number;

  const createToken = (userId: string = 'test-user-id') => {
    return jwt.sign(
      { userId, organizationId: 'test-org' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  };

  beforeEach((done) => {
    httpServer = createServer();
    socketService = initializeSocketService(httpServer);
    
    httpServer.listen(() => {
      port = (httpServer.address() as AddressInfo).port;
      done();
    });
  });

  afterEach((done) => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    
    socketService.shutdown().then(() => {
      httpServer.close(done);
    });
  });

  describe('Authentication', () => {
    it('should reject connection without token', (done) => {
      clientSocket = Client(`http://localhost:${port}`);
      
      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication token required');
        done();
      });
    });

    it('should reject connection with invalid token', (done) => {
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token: 'invalid-token' }
      });
      
      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Invalid authentication token');
        done();
      });
    });

    it('should accept connection with valid token', (done) => {
      const token = createToken();
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });
    });
  });

  describe('Timer Events', () => {
    beforeEach((done) => {
      const token = createToken();
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', () => {
        done();
      });
    });

    it('should handle timer start event', (done) => {
      clientSocket.on('timer:started', (data) => {
        expect(data.timer).toBeDefined();
        expect(data.timer.id).toBe('timer-1');
        expect(data.timer.isRunning).toBe(true);
        expect(data.timestamp).toBeDefined();
        done();
      });

      clientSocket.emit('timer:start', {
        projectId: 'project-1',
        description: 'Test task'
      });
    });

    it('should handle timer stop event', (done) => {
      clientSocket.on('timer:stopped', (data) => {
        expect(data.timeEntry).toBeDefined();
        expect(data.timeEntry.id).toBe('timer-1');
        expect(data.timeEntry.isRunning).toBe(false);
        expect(data.timeEntry.duration).toBe(60);
        expect(data.timestamp).toBeDefined();
        done();
      });

      clientSocket.emit('timer:stop', {});
    });

    it('should handle timer pause event', (done) => {
      clientSocket.on('timer:paused', (data) => {
        expect(data.timer).toBeDefined();
        expect(data.timer.id).toBe('timer-1');
        expect(data.timer.isRunning).toBe(false);
        expect(data.timer.duration).toBe(30);
        expect(data.timestamp).toBeDefined();
        done();
      });

      clientSocket.emit('timer:pause', {});
    });

    it('should send current timer state on connection', (done) => {
      clientSocket.on('timer:state', (data) => {
        expect(data.isRunning).toBe(false);
        expect(data.timer).toBeNull();
        expect(data.timestamp).toBeDefined();
        done();
      });
    });

    it('should handle timer sync request', (done) => {
      clientSocket.on('timer:state', (data) => {
        expect(data.isRunning).toBe(false);
        expect(data.timer).toBeNull();
        expect(data.timestamp).toBeDefined();
        done();
      });

      clientSocket.emit('timer:sync');
    });
  });

  describe('Multi-device Support', () => {
    let secondClientSocket: ClientSocket;

    beforeEach((done) => {
      const token = createToken();
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });
      
      secondClientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });

      let connectCount = 0;
      const onConnect = () => {
        connectCount++;
        if (connectCount === 2) {
          done();
        }
      };

      clientSocket.on('connect', onConnect);
      secondClientSocket.on('connect', onConnect);
    });

    afterEach(() => {
      if (secondClientSocket) {
        secondClientSocket.disconnect();
      }
    });

    it('should broadcast timer events to all user devices', (done) => {
      let eventCount = 0;
      const onTimerStarted = (data: any) => {
        expect(data.timer.id).toBe('timer-1');
        eventCount++;
        if (eventCount === 2) {
          done();
        }
      };

      clientSocket.on('timer:started', onTimerStarted);
      secondClientSocket.on('timer:started', onTimerStarted);

      // Start timer from first client
      clientSocket.emit('timer:start', {
        projectId: 'project-1',
        description: 'Test task'
      });
    });

    it('should track multiple connections for same user', () => {
      expect(socketService.getUserConnectionCount('test-user-id')).toBe(2);
      expect(socketService.isUserConnected('test-user-id')).toBe(true);
    });
  });

  describe('Iframe Visibility Handling', () => {
    beforeEach((done) => {
      const token = createToken();
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', done);
    });

    it('should handle iframe visibility changes', (done) => {
      clientSocket.on('timer:state', (data) => {
        expect(data.isRunning).toBe(false);
        expect(data.timer).toBeNull();
        done();
      });

      clientSocket.emit('iframe:visibility', { visible: true });
    });
  });

  describe('Error Handling', () => {
    beforeEach((done) => {
      const token = createToken();
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', done);
    });

    it('should handle timer service errors', (done) => {
      // Mock timer service to throw error
      const timerService = require('../timerService').getTimerService();
      timerService.startTimer.mockRejectedValueOnce(new Error('Timer service error'));

      clientSocket.on('timer:error', (error) => {
        expect(error.message).toBe('Failed to start timer');
        done();
      });

      clientSocket.emit('timer:start', {
        projectId: 'project-1',
        description: 'Test task'
      });
    });
  });

  describe('Connection Management', () => {
    it('should track connection statistics', () => {
      const stats = socketService.getConnectionStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
    });

    it('should handle graceful shutdown', async () => {
      await expect(socketService.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Broadcasting Methods', () => {
    beforeEach((done) => {
      const token = createToken();
      clientSocket = Client(`http://localhost:${port}`, {
        auth: { token }
      });
      
      clientSocket.on('connect', done);
    });

    it('should broadcast timer updates', (done) => {
      clientSocket.on('timer:update', (data) => {
        expect(data.userId).toBe('test-user-id');
        expect(data.isRunning).toBe(true);
        expect(data.timestamp).toBeDefined();
        done();
      });

      socketService.broadcastTimerUpdate('test-user-id', {
        userId: 'test-user-id',
        timerId: 'timer-1',
        projectId: 'project-1',
        description: 'Test task',
        startTime: new Date(),
        elapsedTime: 0,
        isRunning: true
      });
    });

    it('should broadcast time entry events', (done) => {
      const timeEntry = {
        id: 'entry-1',
        userId: 'test-user-id',
        projectId: 'project-1',
        description: 'Test task',
        duration: 60
      };

      clientSocket.on('timeEntry:created', (data) => {
        expect(data.timeEntry).toEqual(timeEntry);
        expect(data.timestamp).toBeDefined();
        done();
      });

      socketService.broadcastTimeEntryCreated('test-user-id', timeEntry);
    });
  });
});