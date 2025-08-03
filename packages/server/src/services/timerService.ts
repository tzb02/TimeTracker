import { getDatabase } from '../database';
import { 
  TimeEntry, 
  TimeEntryRow, 
  StartTimerRequest, 
  StopTimerRequest,
  TimerState 
} from '../types/models';

// Import socket service for real-time updates (lazy loaded to avoid circular dependency)
let getSocketService: (() => any) | null = null;

export interface TimerConflictError extends Error {
  code: 'TIMER_CONFLICT';
  conflictingEntry: TimeEntry;
}

export class TimerService {
  private db: any;

  constructor(database?: any) {
    this.db = database || getDatabase();
  }

  /**
   * Start a new timer for a user
   */
  async startTimer(userId: string, request: StartTimerRequest): Promise<TimeEntry> {
    return this.db.transaction(async (client: any) => {
      // Check for existing running timer
      const existingTimer = await this.getActiveTimer(userId);
      if (existingTimer) {
        const error = new Error('User already has an active timer') as TimerConflictError;
        error.code = 'TIMER_CONFLICT';
        error.conflictingEntry = existingTimer;
        throw error;
      }

      // Verify project exists and belongs to user
      const projectCheck = await client.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2 AND is_active = true',
        [request.projectId, userId]
      );

      if (projectCheck.rows.length === 0) {
        throw new Error('Project not found or not accessible');
      }

      // Create new time entry
      const startTime = new Date();
      const result = await client.query(`
        INSERT INTO time_entries (
          user_id, project_id, description, start_time, is_running, duration
        ) VALUES ($1, $2, $3, $4, true, 0)
        RETURNING *
      `, [userId, request.projectId, request.description || '', startTime]);

      const timeEntry = this.mapRowToTimeEntry(result.rows[0]);
      
      // Broadcast timer started event (lazy load to avoid circular dependency)
      try {
        if (!getSocketService) {
          const socketModule = require('./socketService');
          getSocketService = socketModule.getSocketService;
        }
        
        if (getSocketService) {
          const socketService = getSocketService();
          socketService.broadcastTimerUpdate(userId, {
            userId,
            timerId: timeEntry.id,
            projectId: timeEntry.projectId,
            description: timeEntry.description,
            startTime: timeEntry.startTime,
            elapsedTime: 0,
            isRunning: true
          });
        }
      } catch (error) {
        // Socket service not available (e.g., in tests)
        console.warn('Socket service not available for timer broadcast:', error);
      }
      
      return timeEntry;
    });
  }

  /**
   * Stop the active timer for a user
   */
  async stopTimer(userId: string, request?: StopTimerRequest): Promise<TimeEntry> {
    return this.db.transaction(async (client: any) => {
      // Get the active timer
      const activeTimer = await this.getActiveTimer(userId);
      if (!activeTimer) {
        throw new Error('No active timer found');
      }

      const endTime = request?.endTime || new Date();
      const duration = Math.floor((endTime.getTime() - activeTimer.startTime.getTime()) / 1000);

      // Validate end time is not before start time
      if (endTime < activeTimer.startTime) {
        throw new Error('End time cannot be before start time');
      }

      // Update the time entry
      const result = await client.query(`
        UPDATE time_entries 
        SET end_time = $1, duration = $2, is_running = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND user_id = $4
        RETURNING *
      `, [endTime, duration, activeTimer.id, userId]);

      if (result.rows.length === 0) {
        throw new Error('Failed to stop timer');
      }

      const timeEntry = this.mapRowToTimeEntry(result.rows[0]);
      
      // Broadcast timer stopped event (lazy load to avoid circular dependency)
      try {
        if (!getSocketService) {
          const socketModule = require('./socketService');
          getSocketService = socketModule.getSocketService;
        }
        
        if (getSocketService) {
          const socketService = getSocketService();
          socketService.broadcastTimerUpdate(userId, {
            userId,
            timerId: timeEntry.id,
            projectId: timeEntry.projectId,
            description: timeEntry.description,
            startTime: timeEntry.startTime,
            elapsedTime: timeEntry.duration,
            isRunning: false
          });
          
          // Also broadcast the created time entry
          socketService.broadcastTimeEntryCreated(userId, timeEntry);
        }
      } catch (error) {
        // Socket service not available (e.g., in tests)
        console.warn('Socket service not available for timer broadcast:', error);
      }
      
      return timeEntry;
    });
  }

  /**
   * Pause the active timer (stops it but keeps it as the current entry)
   */
  async pauseTimer(userId: string): Promise<TimeEntry> {
    return this.stopTimer(userId);
  }

  /**
   * Get the currently active timer for a user
   */
  async getActiveTimer(userId: string): Promise<TimeEntry | null> {
    const result = await this.db.query(
      'SELECT * FROM time_entries WHERE user_id = $1 AND is_running = true',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTimeEntry(result.rows[0]);
  }

  /**
   * Get timer state for a user (includes calculated elapsed time)
   */
  async getTimerState(userId: string): Promise<TimerState> {
    const activeTimer = await this.getActiveTimer(userId);
    
    if (!activeTimer) {
      return {
        isRunning: false,
        elapsedTime: 0,
        lastSync: new Date()
      };
    }

    const elapsedTime = Math.floor((Date.now() - activeTimer.startTime.getTime()) / 1000);

    return {
      isRunning: true,
      currentEntry: activeTimer,
      startTime: activeTimer.startTime,
      elapsedTime,
      lastSync: new Date()
    };
  }

  /**
   * Resolve timer conflicts by stopping the conflicting timer
   */
  async resolveTimerConflict(userId: string, action: 'stop_existing' | 'cancel_new'): Promise<void> {
    if (action === 'stop_existing') {
      const activeTimer = await this.getActiveTimer(userId);
      if (activeTimer) {
        await this.stopTimer(userId);
      }
    }
    // For 'cancel_new', no action needed as the new timer wasn't started
  }

  /**
   * Get all active timers across all users (for admin/monitoring)
   */
  async getAllActiveTimers(): Promise<TimeEntry[]> {
    const result = await this.db.query(`
      SELECT te.*, p.name as project_name, u.name as user_name
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN users u ON te.user_id = u.id
      WHERE te.is_running = true
      ORDER BY te.start_time DESC
    `);

    return result.rows.map((row: any) => this.mapRowToTimeEntry(row));
  }

  /**
   * Force stop all timers for a user (for conflict resolution)
   */
  async forceStopAllTimers(userId: string): Promise<TimeEntry[]> {
    return this.db.transaction(async (client: any) => {
      const result = await client.query(`
        UPDATE time_entries 
        SET 
          end_time = CURRENT_TIMESTAMP,
          duration = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))::INTEGER,
          is_running = false,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND is_running = true
        RETURNING *
      `, [userId]);

      return result.rows.map((row: any) => this.mapRowToTimeEntry(row));
    });
  }

  /**
   * Validate timer state consistency for a user
   */
  async validateTimerState(userId: string): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check for multiple running timers
    const runningTimers = await this.db.query(
      'SELECT COUNT(*) as count FROM time_entries WHERE user_id = $1 AND is_running = true',
      [userId]
    );

    if (parseInt(runningTimers.rows[0].count) > 1) {
      issues.push('Multiple running timers detected');
    }

    // Check for timers with invalid durations
    const invalidDurations = await this.db.query(`
      SELECT COUNT(*) as count FROM time_entries 
      WHERE user_id = $1 AND is_running = false AND (
        duration < 0 OR 
        (end_time IS NOT NULL AND duration != EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER)
      )
    `, [userId]);

    if (parseInt(invalidDurations.rows[0].count) > 0) {
      issues.push('Timers with invalid durations detected');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Map database row to TimeEntry model
   */
  private mapRowToTimeEntry(row: TimeEntryRow): TimeEntry {
    return {
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      description: row.description,
      startTime: row.start_time,
      endTime: row.end_time || undefined,
      duration: row.duration,
      isRunning: row.is_running,
      tags: row.tags || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Singleton instance
let timerService: TimerService | null = null;

export function getTimerService(): TimerService {
  if (!timerService) {
    timerService = new TimerService();
  }
  return timerService;
}