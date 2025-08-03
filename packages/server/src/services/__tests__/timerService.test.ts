import { TimerService, TimerConflictError } from '../timerService';
import { getDatabase } from '../../database';
import { StartTimerRequest, StopTimerRequest } from '../../types/models';

// Mock the database connection
jest.mock('../../database');

const mockDb = {
  query: jest.fn(),
  transaction: jest.fn()
};

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;
mockGetDatabase.mockReturnValue(mockDb as any);

describe('TimerService', () => {
  let timerService: TimerService;
  const mockUserId = 'user-123';
  const mockProjectId = 'project-456';

  beforeEach(() => {
    timerService = new TimerService();
    jest.clearAllMocks();
  });

  describe('startTimer', () => {
    const startRequest: StartTimerRequest = {
      projectId: mockProjectId,
      description: 'Test task'
    };

    it('should start a timer successfully', async () => {
      const mockTimeEntry = {
        id: 'entry-789',
        user_id: mockUserId,
        project_id: mockProjectId,
        description: 'Test task',
        start_time: new Date(),
        end_time: null,
        duration: 0,
        is_running: true,
        tags: [],
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock getActiveTimer to return null (no existing timer)
      jest.spyOn(timerService, 'getActiveTimer').mockResolvedValue(null);

      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [{ id: mockProjectId }] }) // Project exists
            .mockResolvedValueOnce({ rows: [mockTimeEntry] }) // Insert result
        };
        return callback(mockClient);
      });

      const result = await timerService.startTimer(mockUserId, startRequest);

      expect(result).toEqual({
        id: 'entry-789',
        userId: mockUserId,
        projectId: mockProjectId,
        description: 'Test task',
        startTime: mockTimeEntry.start_time,
        endTime: undefined,
        duration: 0,
        isRunning: true,
        tags: [],
        createdAt: mockTimeEntry.created_at,
        updatedAt: mockTimeEntry.updated_at
      });
    });

    it('should throw conflict error when timer already running', async () => {
      const existingTimer = {
        id: 'existing-entry',
        userId: mockUserId,
        projectId: 'other-project',
        description: 'Existing task',
        startTime: new Date(),
        endTime: undefined,
        duration: 0,
        isRunning: true,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock getActiveTimer to return existing timer
      jest.spyOn(timerService, 'getActiveTimer').mockResolvedValue(existingTimer);

      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = { query: jest.fn() };
        return callback(mockClient);
      });

      await expect(timerService.startTimer(mockUserId, startRequest))
        .rejects.toMatchObject({
          message: 'User already has an active timer',
          code: 'TIMER_CONFLICT'
        });
    });

    it('should throw error when project not found', async () => {
      // Mock getActiveTimer to return null (no existing timer)
      jest.spyOn(timerService, 'getActiveTimer').mockResolvedValue(null);

      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [] }) // Project not found
        };
        return callback(mockClient);
      });

      await expect(timerService.startTimer(mockUserId, startRequest))
        .rejects.toThrow('Project not found or not accessible');
    });
  });

  describe('stopTimer', () => {
    const mockActiveTimer = {
      id: 'entry-789',
      userId: mockUserId,
      projectId: mockProjectId,
      description: 'Test task',
      startTime: new Date(Date.now() - 3600000), // 1 hour ago
      endTime: undefined,
      duration: 0,
      isRunning: true,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should stop timer successfully', async () => {
      const endTime = new Date();
      const expectedDuration = Math.floor((endTime.getTime() - mockActiveTimer.startTime.getTime()) / 1000);

      const stoppedEntry = {
        id: 'entry-789',
        user_id: mockUserId,
        project_id: mockProjectId,
        description: 'Test task',
        start_time: mockActiveTimer.startTime,
        end_time: endTime,
        duration: expectedDuration,
        is_running: false,
        tags: [],
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock getActiveTimer
      jest.spyOn(timerService, 'getActiveTimer').mockResolvedValue(mockActiveTimer);

      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [stoppedEntry] }) // Update result
        };
        return callback(mockClient);
      });

      const stopRequest: StopTimerRequest = { endTime };
      const result = await timerService.stopTimer(mockUserId, stopRequest);

      expect(result.isRunning).toBe(false);
      expect(result.endTime).toEqual(endTime);
      expect(result.duration).toBe(expectedDuration);
    });

    it('should throw error when no active timer', async () => {
      jest.spyOn(timerService, 'getActiveTimer').mockResolvedValue(null);

      await expect(timerService.stopTimer(mockUserId))
        .rejects.toThrow('No active timer found');
    });

    it('should throw error when end time is before start time', async () => {
      const invalidEndTime = new Date(mockActiveTimer.startTime.getTime() - 1000);
      jest.spyOn(timerService, 'getActiveTimer').mockResolvedValue(mockActiveTimer);

      const stopRequest: StopTimerRequest = { endTime: invalidEndTime };

      await expect(timerService.stopTimer(mockUserId, stopRequest))
        .rejects.toThrow('End time cannot be before start time');
    });
  });

  describe('getActiveTimer', () => {
    it('should return active timer when exists', async () => {
      const mockTimeEntry = {
        id: 'entry-789',
        user_id: mockUserId,
        project_id: mockProjectId,
        description: 'Test task',
        start_time: new Date(),
        end_time: null,
        duration: 0,
        is_running: true,
        tags: [],
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query.mockResolvedValue({ rows: [mockTimeEntry] });

      const result = await timerService.getActiveTimer(mockUserId);

      expect(result).toEqual({
        id: 'entry-789',
        userId: mockUserId,
        projectId: mockProjectId,
        description: 'Test task',
        startTime: mockTimeEntry.start_time,
        endTime: undefined,
        duration: 0,
        isRunning: true,
        tags: [],
        createdAt: mockTimeEntry.created_at,
        updatedAt: mockTimeEntry.updated_at
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM time_entries WHERE user_id = $1 AND is_running = true',
        [mockUserId]
      );
    });

    it('should return null when no active timer', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await timerService.getActiveTimer(mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('getTimerState', () => {
    it('should return timer state with active timer', async () => {
      const startTime = new Date(Date.now() - 1800000); // 30 minutes ago
      const mockActiveTimer = {
        id: 'entry-789',
        userId: mockUserId,
        projectId: mockProjectId,
        description: 'Test task',
        startTime,
        endTime: undefined,
        duration: 0,
        isRunning: true,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(timerService, 'getActiveTimer').mockResolvedValue(mockActiveTimer);

      const result = await timerService.getTimerState(mockUserId);

      expect(result.isRunning).toBe(true);
      expect(result.currentEntry).toEqual(mockActiveTimer);
      expect(result.startTime).toEqual(startTime);
      expect(result.elapsedTime).toBeGreaterThan(1790); // ~30 minutes in seconds
      expect(result.lastSync).toBeInstanceOf(Date);
    });

    it('should return empty state when no active timer', async () => {
      jest.spyOn(timerService, 'getActiveTimer').mockResolvedValue(null);

      const result = await timerService.getTimerState(mockUserId);

      expect(result.isRunning).toBe(false);
      expect(result.currentEntry).toBeUndefined();
      expect(result.elapsedTime).toBe(0);
      expect(result.lastSync).toBeInstanceOf(Date);
    });
  });

  describe('resolveTimerConflict', () => {
    it('should stop existing timer when action is stop_existing', async () => {
      const mockActiveTimer = {
        id: 'entry-789',
        userId: mockUserId,
        projectId: mockProjectId,
        description: 'Test task',
        startTime: new Date(),
        endTime: undefined,
        duration: 0,
        isRunning: true,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(timerService, 'getActiveTimer').mockResolvedValue(mockActiveTimer);
      const stopTimerSpy = jest.spyOn(timerService, 'stopTimer').mockResolvedValue({} as any);

      await timerService.resolveTimerConflict(mockUserId, 'stop_existing');

      expect(stopTimerSpy).toHaveBeenCalledWith(mockUserId);
    });

    it('should not stop timer when action is cancel_new', async () => {
      const stopTimerSpy = jest.spyOn(timerService, 'stopTimer');

      await timerService.resolveTimerConflict(mockUserId, 'cancel_new');

      expect(stopTimerSpy).not.toHaveBeenCalled();
    });
  });

  describe('forceStopAllTimers', () => {
    it('should force stop all running timers', async () => {
      const mockStoppedTimers = [
        {
          id: 'entry-1',
          user_id: mockUserId,
          project_id: mockProjectId,
          description: 'Task 1',
          start_time: new Date(),
          end_time: new Date(),
          duration: 3600,
          is_running: false,
          tags: [],
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: mockStoppedTimers })
        };
        return callback(mockClient);
      });

      const result = await timerService.forceStopAllTimers(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].isRunning).toBe(false);
    });
  });

  describe('validateTimerState', () => {
    it('should return valid state when no issues', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // One running timer
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // No invalid durations

      const result = await timerService.validateTimerState(mockUserId);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect multiple running timers', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // Multiple running timers
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // No invalid durations

      const result = await timerService.validateTimerState(mockUserId);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Multiple running timers detected');
    });

    it('should detect invalid durations', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // One running timer
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Invalid durations found

      const result = await timerService.validateTimerState(mockUserId);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Timers with invalid durations detected');
    });
  });
});