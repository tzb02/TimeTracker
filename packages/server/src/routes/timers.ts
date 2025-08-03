import { Router, Request, Response } from 'express';
import { body, param } from 'express-validator';
import { TimerService, TimerConflictError } from '../services/timerService';
import { authenticateToken } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';
import { StartTimerRequest, StopTimerRequest } from '../types/models';

const router = Router();
const timerService = new TimerService();

// Apply authentication to all timer routes
router.use(authenticateToken);

/**
 * POST /api/timers/start
 * Start a new timer
 */
router.post('/start',
  [
    body('projectId')
      .isUUID()
      .withMessage('Project ID must be a valid UUID'),
    body('description')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must be a string with max 1000 characters')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const request: StartTimerRequest = {
        projectId: req.body.projectId,
        description: req.body.description
      };

      const timeEntry = await timerService.startTimer(userId, request);

      res.status(201).json({
        success: true,
        data: {
          timeEntry,
          message: 'Timer started successfully'
        }
      });
    } catch (error) {
      if ((error as TimerConflictError).code === 'TIMER_CONFLICT') {
        const conflictError = error as TimerConflictError;
        return res.status(409).json({
          success: false,
          error: {
            code: 'TIMER_CONFLICT',
            message: 'Another timer is already running',
            details: {
              conflictingEntry: conflictError.conflictingEntry
            }
          }
        });
      }

      if (error instanceof Error) {
        if (error.message === 'Project not found or not accessible') {
          return res.status(404).json({
            success: false,
            error: {
              code: 'PROJECT_NOT_FOUND',
              message: 'Project not found or not accessible'
            }
          });
        }
      }

      console.error('Error starting timer:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to start timer'
        }
      });
    }
  }
);

/**
 * POST /api/timers/stop
 * Stop the active timer
 */
router.post('/stop',
  [
    body('endTime')
      .optional()
      .isISO8601()
      .withMessage('End time must be a valid ISO 8601 date')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const request: StopTimerRequest = {
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined
      };

      const timeEntry = await timerService.stopTimer(userId, request);

      res.json({
        success: true,
        data: {
          timeEntry,
          message: 'Timer stopped successfully'
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'No active timer found') {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NO_ACTIVE_TIMER',
              message: 'No active timer found'
            }
          });
        }

        if (error.message === 'End time cannot be before start time') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_END_TIME',
              message: 'End time cannot be before start time'
            }
          });
        }
      }

      console.error('Error stopping timer:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to stop timer'
        }
      });
    }
  }
);

/**
 * POST /api/timers/pause
 * Pause the active timer (alias for stop)
 */
router.post('/pause', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const timeEntry = await timerService.pauseTimer(userId);

    res.json({
      success: true,
      data: {
        timeEntry,
        message: 'Timer paused successfully'
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'No active timer found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_ACTIVE_TIMER',
          message: 'No active timer found'
        }
      });
    }

    console.error('Error pausing timer:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to pause timer'
      }
    });
  }
});

/**
 * GET /api/timers/active
 * Get the currently active timer
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const activeTimer = await timerService.getActiveTimer(userId);

    res.json({
      success: true,
      data: {
        activeTimer,
        hasActiveTimer: activeTimer !== null
      }
    });
  } catch (error) {
    console.error('Error getting active timer:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get active timer'
      }
    });
  }
});

/**
 * GET /api/timers/state
 * Get the current timer state with calculated elapsed time
 */
router.get('/state', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const timerState = await timerService.getTimerState(userId);

    res.json({
      success: true,
      data: timerState
    });
  } catch (error) {
    console.error('Error getting timer state:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get timer state'
      }
    });
  }
});

/**
 * POST /api/timers/resolve-conflict
 * Resolve timer conflicts
 */
router.post('/resolve-conflict',
  [
    body('action')
      .isIn(['stop_existing', 'cancel_new'])
      .withMessage('Action must be either "stop_existing" or "cancel_new"')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const action = req.body.action;

      await timerService.resolveTimerConflict(userId, action);

      res.json({
        success: true,
        data: {
          message: `Timer conflict resolved with action: ${action}`
        }
      });
    } catch (error) {
      console.error('Error resolving timer conflict:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to resolve timer conflict'
        }
      });
    }
  }
);

/**
 * POST /api/timers/force-stop-all
 * Force stop all running timers for the user (emergency action)
 */
router.post('/force-stop-all', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const stoppedTimers = await timerService.forceStopAllTimers(userId);

    res.json({
      success: true,
      data: {
        stoppedTimers,
        count: stoppedTimers.length,
        message: `Force stopped ${stoppedTimers.length} timer(s)`
      }
    });
  } catch (error) {
    console.error('Error force stopping timers:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to force stop timers'
      }
    });
  }
});

/**
 * GET /api/timers/validate
 * Validate timer state consistency
 */
router.get('/validate', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const validation = await timerService.validateTimerState(userId);

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    console.error('Error validating timer state:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to validate timer state'
      }
    });
  }
});

export default router;