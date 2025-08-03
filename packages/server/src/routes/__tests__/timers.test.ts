import request from 'supertest';
import express from 'express';
import timerRoutes from '../timers';
import { TimerService, TimerConflictError } from '../../services/timerService';
import { authenticateToken } from '../../middleware/auth';
import { handleValidationErrors } from '../../middleware/validation';

// Mock dependencies
jest.mock('../../services/timerService');
jest.mock('../../middleware/auth');
jest.mock('../../middleware/validation');

const MockTimerService = TimerService as jest.MockedClass<typeof TimerService>;
const mockAuthenticateToken = authenticateToken as jest.MockedFunction<typeof authenticateToken>;
const mockValidateRequest = handleValidationErrors as jest.MockedFunction<typeof handleValidationErrors>;

describe('Timer Routes', () => {
  let app: express.Application;
  let mockTimerService: jest.Mocked<TimerService>;

  const mockUser = {
    userId: 'user-123',
    email: 'test@example.com',
    role: 'user'
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock middleware
    mockAuthenticateToken.mockImplementation(async (req: any, res: any, next: any) => {
      req.user = mockUser;
      next();
    });

    mockValidateRequest.mockImplementation((req: any, res: any, next: any) => {
      next();
    });

    // Mock timer service
    mockTimerService = {
      startTimer: jest.fn(),
      stopTimer: jest.fn(),
      pauseTimer: jest.fn(),
      getActiveTimer: jest.fn(),
      getTimerState: jest.fn(),
      resolveTimerConflict: jest.fn(),
      forceStopAllTimers: jest.fn(),
      validateTimerState: jest.fn(),
      getAllActiveTimers: jest.fn()
    } as any;

    MockTimerService.mockImplementation(() => mockTimerService);

    app.use('/api/timers', timerRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/timers/start', () => {
    const validStartRequest = {
      projectId: 'project-456',
      description: 'Test task'
    };

    const mockTimeEntry = {
      id: 'entry-789',
      userId: 'user-123',
      projectId: 'project-456',
      description: 'Test task',
      startTime: new Date(),
      endTime: undefined,
      duration: 0,
      isRunning: true,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should start timer successfully', async () => {
      mockTimerService.startTimer.mockResolvedValue(mockTimeEntry);

      const response = await request(app)
        .post('/api/timers/start')
        .send(validStartRequest);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.timeEntry).toEqual(mockTimeEntry);
      expect(response.body.data.message).toBe('Timer started successfully');
      expect(mockTimerService.startTimer).toHaveBeenCalledWith(mockUser.userId, validStartRequest);
    });

    it('should handle timer conflict error', async () => {
      const conflictError = new Error('User already has an active timer') as TimerConflictError;
      conflictError.code = 'TIMER_CONFLICT';
      conflictError.conflictingEntry = mockTimeEntry;

      mockTimerService.startTimer.mockRejectedValue(conflictError);

      const response = await request(app)
        .post('/api/timers/start')
        .send(validStartRequest);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TIMER_CONFLICT');
      expect(response.body.error.details.conflictingEntry).toEqual(mockTimeEntry);
    });

    it('should handle project not found error', async () => {
      mockTimerService.startTimer.mockRejectedValue(new Error('Project not found or not accessible'));

      const response = await request(app)
        .post('/api/timers/start')
        .send(validStartRequest);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('should handle internal server error', async () => {
      mockTimerService.startTimer.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/timers/start')
        .send(validStartRequest);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /api/timers/stop', () => {
    const mockStoppedEntry = {
      id: 'entry-789',
      userId: 'user-123',
      projectId: 'project-456',
      description: 'Test task',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(),
      duration: 3600,
      isRunning: false,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should stop timer successfully', async () => {
      mockTimerService.stopTimer.mockResolvedValue(mockStoppedEntry);

      const response = await request(app)
        .post('/api/timers/stop')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.timeEntry).toEqual(mockStoppedEntry);
      expect(response.body.data.message).toBe('Timer stopped successfully');
      expect(mockTimerService.stopTimer).toHaveBeenCalledWith(mockUser.userId, { endTime: undefined });
    });

    it('should stop timer with custom end time', async () => {
      const customEndTime = new Date().toISOString();
      mockTimerService.stopTimer.mockResolvedValue(mockStoppedEntry);

      const response = await request(app)
        .post('/api/timers/stop')
        .send({ endTime: customEndTime });

      expect(response.status).toBe(200);
      expect(mockTimerService.stopTimer).toHaveBeenCalledWith(
        mockUser.userId, 
        { endTime: new Date(customEndTime) }
      );
    });

    it('should handle no active timer error', async () => {
      mockTimerService.stopTimer.mockRejectedValue(new Error('No active timer found'));

      const response = await request(app)
        .post('/api/timers/stop')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_ACTIVE_TIMER');
    });

    it('should handle invalid end time error', async () => {
      mockTimerService.stopTimer.mockRejectedValue(new Error('End time cannot be before start time'));

      const response = await request(app)
        .post('/api/timers/stop')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_END_TIME');
    });
  });

  describe('POST /api/timers/pause', () => {
    const mockPausedEntry = {
      id: 'entry-789',
      userId: 'user-123',
      projectId: 'project-456',
      description: 'Test task',
      startTime: new Date(Date.now() - 1800000),
      endTime: new Date(),
      duration: 1800,
      isRunning: false,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should pause timer successfully', async () => {
      mockTimerService.pauseTimer.mockResolvedValue(mockPausedEntry);

      const response = await request(app)
        .post('/api/timers/pause');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.timeEntry).toEqual(mockPausedEntry);
      expect(response.body.data.message).toBe('Timer paused successfully');
      expect(mockTimerService.pauseTimer).toHaveBeenCalledWith(mockUser.userId);
    });

    it('should handle no active timer error', async () => {
      mockTimerService.pauseTimer.mockRejectedValue(new Error('No active timer found'));

      const response = await request(app)
        .post('/api/timers/pause');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_ACTIVE_TIMER');
    });
  });

  describe('GET /api/timers/active', () => {
    const mockActiveTimer = {
      id: 'entry-789',
      userId: 'user-123',
      projectId: 'project-456',
      description: 'Test task',
      startTime: new Date(),
      endTime: undefined,
      duration: 0,
      isRunning: true,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should return active timer when exists', async () => {
      mockTimerService.getActiveTimer.mockResolvedValue(mockActiveTimer);

      const response = await request(app)
        .get('/api/timers/active');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.activeTimer).toEqual(mockActiveTimer);
      expect(response.body.data.hasActiveTimer).toBe(true);
      expect(mockTimerService.getActiveTimer).toHaveBeenCalledWith(mockUser.userId);
    });

    it('should return null when no active timer', async () => {
      mockTimerService.getActiveTimer.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/timers/active');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.activeTimer).toBeNull();
      expect(response.body.data.hasActiveTimer).toBe(false);
    });
  });

  describe('GET /api/timers/state', () => {
    const mockTimerState = {
      isRunning: true,
      currentEntry: {
        id: 'entry-789',
        userId: 'user-123',
        projectId: 'project-456',
        description: 'Test task',
        startTime: new Date(),
        endTime: undefined,
        duration: 0,
        isRunning: true,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      startTime: new Date(),
      elapsedTime: 1800,
      lastSync: new Date()
    };

    it('should return timer state', async () => {
      mockTimerService.getTimerState.mockResolvedValue(mockTimerState);

      const response = await request(app)
        .get('/api/timers/state');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTimerState);
      expect(mockTimerService.getTimerState).toHaveBeenCalledWith(mockUser.userId);
    });
  });

  describe('POST /api/timers/resolve-conflict', () => {
    it('should resolve conflict with stop_existing action', async () => {
      mockTimerService.resolveTimerConflict.mockResolvedValue();

      const response = await request(app)
        .post('/api/timers/resolve-conflict')
        .send({ action: 'stop_existing' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Timer conflict resolved with action: stop_existing');
      expect(mockTimerService.resolveTimerConflict).toHaveBeenCalledWith(mockUser.userId, 'stop_existing');
    });

    it('should resolve conflict with cancel_new action', async () => {
      mockTimerService.resolveTimerConflict.mockResolvedValue();

      const response = await request(app)
        .post('/api/timers/resolve-conflict')
        .send({ action: 'cancel_new' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Timer conflict resolved with action: cancel_new');
      expect(mockTimerService.resolveTimerConflict).toHaveBeenCalledWith(mockUser.userId, 'cancel_new');
    });
  });

  describe('POST /api/timers/force-stop-all', () => {
    const mockStoppedTimers = [
      {
        id: 'entry-1',
        userId: 'user-123',
        projectId: 'project-456',
        description: 'Task 1',
        startTime: new Date(),
        endTime: new Date(),
        duration: 3600,
        isRunning: false,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    it('should force stop all timers', async () => {
      mockTimerService.forceStopAllTimers.mockResolvedValue(mockStoppedTimers);

      const response = await request(app)
        .post('/api/timers/force-stop-all');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stoppedTimers).toEqual(mockStoppedTimers);
      expect(response.body.data.count).toBe(1);
      expect(response.body.data.message).toBe('Force stopped 1 timer(s)');
      expect(mockTimerService.forceStopAllTimers).toHaveBeenCalledWith(mockUser.userId);
    });
  });

  describe('GET /api/timers/validate', () => {
    const mockValidation = {
      isValid: true,
      issues: []
    };

    it('should validate timer state', async () => {
      mockTimerService.validateTimerState.mockResolvedValue(mockValidation);

      const response = await request(app)
        .get('/api/timers/validate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockValidation);
      expect(mockTimerService.validateTimerState).toHaveBeenCalledWith(mockUser.userId);
    });

    it('should return validation issues', async () => {
      const invalidValidation = {
        isValid: false,
        issues: ['Multiple running timers detected']
      };

      mockTimerService.validateTimerState.mockResolvedValue(invalidValidation);

      const response = await request(app)
        .get('/api/timers/validate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(invalidValidation);
    });
  });
});