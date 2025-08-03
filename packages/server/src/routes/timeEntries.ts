import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { TimeEntryService, TimeEntryFilters, BulkUpdateRequest, BulkDeleteRequest } from '../services/timeEntryService';
import { authenticateToken } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';
import { CreateTimeEntryRequest, UpdateTimeEntryRequest } from '../types/models';

const router = Router();
const timeEntryService = new TimeEntryService();

// Apply authentication to all time entry routes
router.use(authenticateToken);

/**
 * GET /api/entries
 * Get time entries for the authenticated user with optional filtering
 */
router.get('/',
  [
    query('projectId')
      .optional()
      .isUUID()
      .withMessage('Project ID must be a valid UUID'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    query('isRunning')
      .optional()
      .isBoolean()
      .withMessage('isRunning must be a boolean'),
    query('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    query('search')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search term must be between 1 and 100 characters'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer'),
    query('groupByProject')
      .optional()
      .isBoolean()
      .withMessage('groupByProject must be a boolean')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const groupByProject = req.query.groupByProject === 'true';

      const filters: TimeEntryFilters = {
        projectId: req.query.projectId as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        isRunning: req.query.isRunning ? req.query.isRunning === 'true' : undefined,
        tags: req.query.tags as string[],
        search: req.query.search as string
      };

      if (groupByProject) {
        const groupedEntries = await timeEntryService.getTimeEntriesByProject(userId, filters);
        return res.json({
          success: true,
          data: {
            projects: groupedEntries,
            count: groupedEntries.length
          }
        });
      }

      const { entries, total } = await timeEntryService.getTimeEntries(userId, filters, limit, offset);

      res.json({
        success: true,
        data: {
          entries,
          total,
          limit,
          offset,
          hasMore: offset + entries.length < total
        }
      });
    } catch (error) {
      console.error('Error getting time entries:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get time entries'
        }
      });
    }
  }
);

/**
 * GET /api/entries/stats
 * Get time entry statistics for the authenticated user
 */
router.get('/stats',
  [
    query('projectId')
      .optional()
      .isUUID()
      .withMessage('Project ID must be a valid UUID'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    query('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;

      const filters: TimeEntryFilters = {
        projectId: req.query.projectId as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        tags: req.query.tags as string[]
      };

      const stats = await timeEntryService.getTimeEntryStats(userId, filters);

      res.json({
        success: true,
        data: {
          stats
        }
      });
    } catch (error) {
      console.error('Error getting time entry stats:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get time entry statistics'
        }
      });
    }
  }
);

/**
 * GET /api/entries/search
 * Search time entries by description or project name
 */
router.get('/search',
  [
    query('q')
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const searchTerm = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const { entries, total } = await timeEntryService.searchTimeEntries(userId, searchTerm, limit, offset);

      res.json({
        success: true,
        data: {
          entries,
          total,
          limit,
          offset,
          hasMore: offset + entries.length < total,
          searchTerm
        }
      });
    } catch (error) {
      console.error('Error searching time entries:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to search time entries'
        }
      });
    }
  }
);/**

 * GET /api/entries/:id
 * Get a specific time entry by ID
 */
router.get('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Entry ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const entryId = req.params.id;

      const entry = await timeEntryService.getTimeEntryById(userId, entryId);

      if (!entry) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ENTRY_NOT_FOUND',
            message: 'Time entry not found or not accessible'
          }
        });
      }

      res.json({
        success: true,
        data: {
          entry
        }
      });
    } catch (error) {
      console.error('Error getting time entry:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get time entry'
        }
      });
    }
  }
);

/**
 * POST /api/entries
 * Create a new time entry
 */
router.post('/',
  [
    body('projectId')
      .isUUID()
      .withMessage('Project ID must be a valid UUID'),
    body('description')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must be a string with max 1000 characters'),
    body('startTime')
      .optional()
      .isISO8601()
      .withMessage('Start time must be a valid ISO 8601 date')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const request: CreateTimeEntryRequest = {
        projectId: req.body.projectId,
        description: req.body.description,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined
      };

      const entry = await timeEntryService.createTimeEntry(userId, request);

      res.status(201).json({
        success: true,
        data: {
          entry,
          message: 'Time entry created successfully'
        }
      });
    } catch (error) {
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

        if (error.message === 'Cannot create time entry while another timer is running') {
          return res.status(409).json({
            success: false,
            error: {
              code: 'TIMER_RUNNING',
              message: 'Cannot create time entry while another timer is running'
            }
          });
        }
      }

      console.error('Error creating time entry:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create time entry'
        }
      });
    }
  }
);

/**
 * PUT /api/entries/:id
 * Update a time entry
 */
router.put('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Entry ID must be a valid UUID'),
    body('projectId')
      .optional()
      .isUUID()
      .withMessage('Project ID must be a valid UUID'),
    body('description')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must be a string with max 1000 characters'),
    body('startTime')
      .optional()
      .isISO8601()
      .withMessage('Start time must be a valid ISO 8601 date'),
    body('endTime')
      .optional()
      .isISO8601()
      .withMessage('End time must be a valid ISO 8601 date'),
    body('duration')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Duration must be a non-negative integer'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('tags.*')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Each tag must be between 1 and 50 characters')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const entryId = req.params.id;
      const request: UpdateTimeEntryRequest = {
        projectId: req.body.projectId,
        description: req.body.description,
        startTime: req.body.startTime ? new Date(req.body.startTime) : undefined,
        endTime: req.body.endTime ? new Date(req.body.endTime) : undefined,
        duration: req.body.duration,
        tags: req.body.tags
      };

      const entry = await timeEntryService.updateTimeEntry(userId, entryId, request);

      res.json({
        success: true,
        data: {
          entry,
          message: 'Time entry updated successfully'
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Time entry not found or not accessible') {
          return res.status(404).json({
            success: false,
            error: {
              code: 'ENTRY_NOT_FOUND',
              message: 'Time entry not found or not accessible'
            }
          });
        }

        if (error.message === 'Project not found or not accessible') {
          return res.status(404).json({
            success: false,
            error: {
              code: 'PROJECT_NOT_FOUND',
              message: 'Project not found or not accessible'
            }
          });
        }

        if (error.message === 'End time must be after start time') {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_TIME_RANGE',
              message: 'End time must be after start time'
            }
          });
        }
      }

      console.error('Error updating time entry:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update time entry'
        }
      });
    }
  }
);

/**
 * DELETE /api/entries/:id
 * Delete a time entry
 */
router.delete('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Entry ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const entryId = req.params.id;

      await timeEntryService.deleteTimeEntry(userId, entryId);

      res.json({
        success: true,
        data: {
          message: 'Time entry deleted successfully'
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Time entry not found or not accessible') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ENTRY_NOT_FOUND',
            message: 'Time entry not found or not accessible'
          }
        });
      }

      console.error('Error deleting time entry:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete time entry'
        }
      });
    }
  }
);

/**
 * PUT /api/entries/bulk
 * Bulk update time entries
 */
router.put('/bulk',
  [
    body('entryIds')
      .isArray({ min: 1 })
      .withMessage('Entry IDs must be a non-empty array'),
    body('entryIds.*')
      .isUUID()
      .withMessage('Each entry ID must be a valid UUID'),
    body('updates')
      .isObject()
      .withMessage('Updates must be an object'),
    body('updates.projectId')
      .optional()
      .isUUID()
      .withMessage('Project ID must be a valid UUID'),
    body('updates.description')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must be a string with max 1000 characters'),
    body('updates.tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('updates.tags.*')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Each tag must be between 1 and 50 characters')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const request: BulkUpdateRequest = {
        entryIds: req.body.entryIds,
        updates: req.body.updates
      };

      const entries = await timeEntryService.bulkUpdateTimeEntries(userId, request);

      res.json({
        success: true,
        data: {
          entries,
          count: entries.length,
          message: `${entries.length} time entries updated successfully`
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'One or more time entries not found or not accessible') {
          return res.status(404).json({
            success: false,
            error: {
              code: 'ENTRIES_NOT_FOUND',
              message: 'One or more time entries not found or not accessible'
            }
          });
        }

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

      console.error('Error bulk updating time entries:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to bulk update time entries'
        }
      });
    }
  }
);

/**
 * DELETE /api/entries/bulk
 * Bulk delete time entries
 */
router.delete('/bulk',
  [
    body('entryIds')
      .isArray({ min: 1 })
      .withMessage('Entry IDs must be a non-empty array'),
    body('entryIds.*')
      .isUUID()
      .withMessage('Each entry ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const request: BulkDeleteRequest = {
        entryIds: req.body.entryIds
      };

      await timeEntryService.bulkDeleteTimeEntries(userId, request);

      res.json({
        success: true,
        data: {
          count: request.entryIds.length,
          message: `${request.entryIds.length} time entries deleted successfully`
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'One or more time entries not found or not accessible') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ENTRIES_NOT_FOUND',
            message: 'One or more time entries not found or not accessible'
          }
        });
      }

      console.error('Error bulk deleting time entries:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to bulk delete time entries'
        }
      });
    }
  }
);

export default router;