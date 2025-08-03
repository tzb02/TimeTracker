/**
 * Manual test file to verify timer implementation
 * This file demonstrates the timer service functionality
 * Run with: npm test -- --testPathPattern="timer-manual"
 */

import { TimerService } from '../services/timerService';
import { StartTimerRequest, StopTimerRequest } from '../types/models';

describe('Timer Implementation Manual Test', () => {
  let timerService: TimerService;
  const mockDb = {
    query: jest.fn(),
    transaction: jest.fn()
  };

  beforeEach(() => {
    timerService = new TimerService(mockDb);
    jest.clearAllMocks();
  });

  it('should demonstrate timer service workflow', async () => {
    const userId = 'test-user-123';
    const projectId = 'test-project-456';

    // Mock successful timer start
    const mockTimeEntry = {
      id: 'entry-789',
      user_id: userId,
      project_id: projectId,
      description: 'Test task',
      start_time: new Date(),
      end_time: null,
      duration: 0,
      is_running: true,
      tags: [],
      created_at: new Date(),
      updated_at: new Date()
    };

    // Mock getActiveTimer to return null initially
    jest.spyOn(timerService, 'getActiveTimer').mockResolvedValue(null);

    // Mock transaction for starting timer
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: projectId }] }) // Project exists
          .mockResolvedValueOnce({ rows: [mockTimeEntry] }) // Insert result
      };
      return callback(mockClient);
    });

    // Test starting a timer
    const startRequest: StartTimerRequest = {
      projectId,
      description: 'Test task'
    };

    const startedTimer = await timerService.startTimer(userId, startRequest);
    
    expect(startedTimer).toBeDefined();
    expect(startedTimer.userId).toBe(userId);
    expect(startedTimer.projectId).toBe(projectId);
    expect(startedTimer.isRunning).toBe(true);

    console.log('✅ Timer started successfully');

    // Test getting timer state
    jest.spyOn(timerService, 'getActiveTimer').mockResolvedValue(startedTimer);
    
    const timerState = await timerService.getTimerState(userId);
    
    expect(timerState.isRunning).toBe(true);
    expect(timerState.currentEntry).toBeDefined();
    expect(timerState.elapsedTime).toBeGreaterThanOrEqual(0);

    console.log('✅ Timer state retrieved successfully');

    // Test stopping the timer
    const stoppedEntry = {
      ...mockTimeEntry,
      end_time: new Date(),
      duration: 3600,
      is_running: false
    };

    mockDb.transaction.mockImplementation(async (callback) => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [stoppedEntry] })
      };
      return callback(mockClient);
    });

    const stopRequest: StopTimerRequest = {};
    const stoppedTimer = await timerService.stopTimer(userId, stopRequest);

    expect(stoppedTimer).toBeDefined();
    expect(stoppedTimer.isRunning).toBe(false);
    expect(stoppedTimer.duration).toBeGreaterThan(0);

    console.log('✅ Timer stopped successfully');
    console.log('🎉 Timer service workflow completed successfully!');
  });

  it('should demonstrate timer conflict resolution', async () => {
    const userId = 'test-user-123';
    const existingTimer = {
      id: 'existing-entry',
      userId,
      projectId: 'project-1',
      description: 'Existing task',
      startTime: new Date(),
      endTime: undefined,
      duration: 0,
      isRunning: true,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Mock existing timer
    jest.spyOn(timerService, 'getActiveTimer').mockResolvedValue(existingTimer);

    // Test conflict detection
    const startRequest: StartTimerRequest = {
      projectId: 'project-2',
      description: 'New task'
    };

    mockDb.transaction.mockImplementation(async (callback) => {
      const mockClient = { query: jest.fn() };
      return callback(mockClient);
    });

    try {
      await timerService.startTimer(userId, startRequest);
      fail('Should have thrown conflict error');
    } catch (error: any) {
      expect(error.code).toBe('TIMER_CONFLICT');
      expect(error.conflictingEntry).toEqual(existingTimer);
      console.log('✅ Timer conflict detected successfully');
    }

    // Test conflict resolution
    jest.spyOn(timerService, 'stopTimer').mockResolvedValue({} as any);
    
    await timerService.resolveTimerConflict(userId, 'stop_existing');
    
    console.log('✅ Timer conflict resolved successfully');
    console.log('🎉 Timer conflict resolution workflow completed!');
  });

  it('should validate timer state consistency', async () => {
    const userId = 'test-user-123';

    // Mock validation queries
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // One running timer
      .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // No invalid durations

    const validation = await timerService.validateTimerState(userId);

    expect(validation.isValid).toBe(true);
    expect(validation.issues).toHaveLength(0);

    console.log('✅ Timer state validation completed successfully');
    console.log('🎉 All timer service features working correctly!');
  });
});