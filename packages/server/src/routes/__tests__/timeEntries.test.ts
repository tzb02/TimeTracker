import request from 'supertest';
import express from 'express';
import timeEntryRoutes from '../timeEntries';
import { TimeEntryService } from '../../services/timeEntryService';
import { authenticateToken } from '../../middleware/auth';

// Mock the TimeEntryService
jest.mock('../../services/timeEntryService');
const MockTimeEntryService = TimeEntryService as jest.MockedClass<typeof TimeEntryService>;

// Mock the auth middleware
jest.mock('../../middleware/auth');
const mockAuthenticateToken = authenticateToken as jest.MockedFunction<typeof authenticateToken>;

describe('Time Entry Routes', () => {
  let app: express.Application;
  let mockService: jest.Mocked<TimeEntryService>;

  const mockUser = {
    userId: 'user-123',
    email: 'test@example.com'
  };

  beforeEach(() => {
    // Create mock service instance
    mockService = {
      createTimeEntry: jest.fn(),
      getTimeEntries: jest.fn(),
      getTimeEntryById: jest.fn(),
      updateTimeEntry: jest.fn(),
      deleteTimeEntry: jest.fn(),
      bulkUpdateTimeEntries: jest.fn(),
      bulkDeleteTimeEntries: jest.fn(),
      getTimeEntryStats: jest.fn(),
      searchTimeEntries: jest.fn(),
      getTimeEntriesByProject: jest.fn(),
      validateTimeEntryOwnership: jest.fn(),
      getRunningTimeEntry: jest.fn()
    } as any;

    MockTimeEntryService.mockImplementation(() => mockService);

    app = express();
    app.use(express.json());
    
    // Mock authentication middleware to add user to request
    mockAuthenticateToken.mockImplementation(async (req: any, res, next) => {
      req.user = mockUser;
      next();
    });

    app.use('/api/entries', timeEntryRoutes);

    jest.clearAllMocks();
  });

  describe('GET /api/entries', () => {
    const mockEntries = [
      {
        id: 'entry-1',
        userId: 'user-123',
        projectId: 'project-1',
        description: 'Test task',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T11:00:00Z'),
        duration: 3600,
        isRunning: false,
        tags: ['tag1'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    it('should get time entries successfully', async () => {
      mockService.getTimeEntries.mockResolvedValue({
        entries: mockEntries,
        total: 1
      });

      const response = await request(app)
        .get('/api/entries')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          entries: expect.arrayContaining([
            expect.objectContaining({
              id: 'entry-1',
              description: 'Test task'
            })
          ]),
          total: 1,
          limit: 50,
          offset: 0,
          hasMore: false
        }
      });

      expect(mockService.getTimeEntries).toHaveBeenCalledWith(
        'user-123',
        {},
        50,
        0
      );
    });

    it('should apply filters correctly', async () => {
      mockService.getTimeEntries.mockResolvedValue({
        entries: mockEntries,
        total: 1
      });

      await request(app)
        .get('/api/entries')
        .query({
          projectId: 'project-1',
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-31T23:59:59Z',
          isRunning: 'false',
          search: 'test',
          limit: '25',
          offset: '10'
        })
        .expect(200);

      expect(mockService.getTimeEntries).toHaveBeenCalledWith(
        'user-123',
        {
          projectId: 'project-1',
          startDate: new Date('2024-01-01T00:00:00Z'),
          endDate: new Date('2024-01-31T23:59:59Z'),
          isRunning: false,
          tags: undefined,
          search: 'test'
        },
        25,
        10
      );
    });

    it('should group by project when requested', async () => {
      const mockGroupedEntries = [
        {
          projectId: 'project-1',
          projectName: 'Test Project',
          projectColor: '#3B82F6',
          entries: mockEntries,
          totalDuration: 3600
        }
      ];

      mockService.getTimeEntriesByProject.mockResolvedValue(mockGroupedEntries);

      const response = await request(app)
        .get('/api/entries')
        .query({ groupByProject: 'true' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          projects: mockGroupedEntries,
          count: 1
        }
      });

      expect(mockService.getTimeEntriesByProject).toHaveBeenCalledWith('user-123', {});
    });

    it('should validate query parameters', async () => {
      await request(app)
        .get('/api/entries')
        .query({
          projectId: 'invalid-uuid',
          limit: '150', // Too high
          offset: '-1' // Negative
        })
        .expect(400);
    });

    it('should handle service errors', async () => {
      mockService.getTimeEntries.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/entries')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get time entries'
        }
      });
    });
  });

  describe('GET /api/entries/stats', () => {
    const mockStats = {
      totalEntries: 10,
      totalDuration: 36000,
      averageDuration: 3600,
      longestEntry: 7200,
      shortestEntry: 1800
    };

    it('should get time entry statistics', async () => {
      mockService.getTimeEntryStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/entries/stats')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          stats: mockStats
        }
      });

      expect(mockService.getTimeEntryStats).toHaveBeenCalledWith('user-123', {});
    });

    it('should apply filters to stats', async () => {
      mockService.getTimeEntryStats.mockResolvedValue(mockStats);

      await request(app)
        .get('/api/entries/stats')
        .query({
          projectId: 'project-1',
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-31T23:59:59Z'
        })
        .expect(200);

      expect(mockService.getTimeEntryStats).toHaveBeenCalledWith('user-123', {
        projectId: 'project-1',
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: new Date('2024-01-31T23:59:59Z'),
        tags: undefined
      });
    });
  });

  describe('GET /api/entries/search', () => {
    const mockSearchResults = {
      entries: [
        {
          id: 'entry-1',
          userId: 'user-123',
          projectId: 'project-1',
          description: 'Test task',
          startTime: new Date(),
          endTime: undefined,
          duration: 0,
          isRunning: false,
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      total: 1
    };

    it('should search time entries', async () => {
      mockService.searchTimeEntries.mockResolvedValue(mockSearchResults);

      const response = await request(app)
        .get('/api/entries/search')
        .query({ q: 'test' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          entries: expect.any(Array),
          total: 1,
          limit: 50,
          offset: 0,
          hasMore: false,
          searchTerm: 'test'
        }
      });

      expect(mockService.searchTimeEntries).toHaveBeenCalledWith('user-123', 'test', 50, 0);
    });

    it('should require search query', async () => {
      await request(app)
        .get('/api/entries/search')
        .expect(400);
    });

    it('should validate search query length', async () => {
      await request(app)
        .get('/api/entries/search')
        .query({ q: 'a'.repeat(101) }) // Too long
        .expect(400);
    });
  });

  describe('GET /api/entries/:id', () => {
    const mockEntry = {
      id: 'entry-1',
      userId: 'user-123',
      projectId: 'project-1',
      description: 'Test task',
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: undefined,
      duration: 0,
      isRunning: false,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should get time entry by ID', async () => {
      mockService.getTimeEntryById.mockResolvedValue(mockEntry);

      const response = await request(app)
        .get('/api/entries/entry-1')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          entry: expect.objectContaining({
            id: 'entry-1',
            description: 'Test task'
          })
        }
      });

      expect(mockService.getTimeEntryById).toHaveBeenCalledWith('user-123', 'entry-1');
    });

    it('should return 404 if entry not found', async () => {
      mockService.getTimeEntryById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/entries/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'ENTRY_NOT_FOUND',
          message: 'Time entry not found or not accessible'
        }
      });
    });

    it('should validate UUID format', async () => {
      await request(app)
        .get('/api/entries/invalid-uuid')
        .expect(400);
    });
  });

  describe('POST /api/entries', () => {
    const mockCreatedEntry = {
      id: 'entry-1',
      userId: 'user-123',
      projectId: 'project-1',
      description: 'New task',
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: undefined,
      duration: 0,
      isRunning: false,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should create time entry successfully', async () => {
      mockService.createTimeEntry.mockResolvedValue(mockCreatedEntry);

      const response = await request(app)
        .post('/api/entries')
        .send({
          projectId: 'project-1',
          description: 'New task',
          startTime: '2024-01-01T10:00:00Z'
        })
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: {
          entry: expect.objectContaining({
            id: 'entry-1',
            description: 'New task'
          }),
          message: 'Time entry created successfully'
        }
      });

      expect(mockService.createTimeEntry).toHaveBeenCalledWith('user-123', {
        projectId: 'project-1',
        description: 'New task',
        startTime: new Date('2024-01-01T10:00:00Z')
      });
    });

    it('should require projectId', async () => {
      await request(app)
        .post('/api/entries')
        .send({
          description: 'New task'
        })
        .expect(400);
    });

    it('should validate projectId format', async () => {
      await request(app)
        .post('/api/entries')
        .send({
          projectId: 'invalid-uuid',
          description: 'New task'
        })
        .expect(400);
    });

    it('should handle project not found error', async () => {
      mockService.createTimeEntry.mockRejectedValue(new Error('Project not found or not accessible'));

      const response = await request(app)
        .post('/api/entries')
        .send({
          projectId: 'project-1',
          description: 'New task'
        })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or not accessible'
        }
      });
    });

    it('should handle timer running error', async () => {
      mockService.createTimeEntry.mockRejectedValue(new Error('Cannot create time entry while another timer is running'));

      const response = await request(app)
        .post('/api/entries')
        .send({
          projectId: 'project-1',
          description: 'New task'
        })
        .expect(409);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'TIMER_RUNNING',
          message: 'Cannot create time entry while another timer is running'
        }
      });
    });
  });

  describe('PUT /api/entries/:id', () => {
    const mockUpdatedEntry = {
      id: 'entry-1',
      userId: 'user-123',
      projectId: 'project-1',
      description: 'Updated task',
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T11:00:00Z'),
      duration: 3600,
      isRunning: false,
      tags: ['updated'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should update time entry successfully', async () => {
      mockService.updateTimeEntry.mockResolvedValue(mockUpdatedEntry);

      const response = await request(app)
        .put('/api/entries/entry-1')
        .send({
          description: 'Updated task',
          endTime: '2024-01-01T11:00:00Z',
          tags: ['updated']
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          entry: expect.objectContaining({
            id: 'entry-1',
            description: 'Updated task'
          }),
          message: 'Time entry updated successfully'
        }
      });

      expect(mockService.updateTimeEntry).toHaveBeenCalledWith('user-123', 'entry-1', {
        projectId: undefined,
        description: 'Updated task',
        startTime: undefined,
        endTime: new Date('2024-01-01T11:00:00Z'),
        duration: undefined,
        tags: ['updated']
      });
    });

    it('should validate entry ID format', async () => {
      await request(app)
        .put('/api/entries/invalid-uuid')
        .send({ description: 'Updated' })
        .expect(400);
    });

    it('should validate request body', async () => {
      await request(app)
        .put('/api/entries/entry-1')
        .send({
          projectId: 'invalid-uuid',
          duration: -1,
          tags: 'not-an-array'
        })
        .expect(400);
    });

    it('should handle entry not found error', async () => {
      mockService.updateTimeEntry.mockRejectedValue(new Error('Time entry not found or not accessible'));

      const response = await request(app)
        .put('/api/entries/entry-1')
        .send({ description: 'Updated' })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'ENTRY_NOT_FOUND',
          message: 'Time entry not found or not accessible'
        }
      });
    });

    it('should handle invalid time range error', async () => {
      mockService.updateTimeEntry.mockRejectedValue(new Error('End time must be after start time'));

      const response = await request(app)
        .put('/api/entries/entry-1')
        .send({
          startTime: '2024-01-01T12:00:00Z',
          endTime: '2024-01-01T11:00:00Z'
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_TIME_RANGE',
          message: 'End time must be after start time'
        }
      });
    });
  });

  describe('DELETE /api/entries/:id', () => {
    it('should delete time entry successfully', async () => {
      mockService.deleteTimeEntry.mockResolvedValue();

      const response = await request(app)
        .delete('/api/entries/entry-1')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          message: 'Time entry deleted successfully'
        }
      });

      expect(mockService.deleteTimeEntry).toHaveBeenCalledWith('user-123', 'entry-1');
    });

    it('should validate entry ID format', async () => {
      await request(app)
        .delete('/api/entries/invalid-uuid')
        .expect(400);
    });

    it('should handle entry not found error', async () => {
      mockService.deleteTimeEntry.mockRejectedValue(new Error('Time entry not found or not accessible'));

      const response = await request(app)
        .delete('/api/entries/entry-1')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'ENTRY_NOT_FOUND',
          message: 'Time entry not found or not accessible'
        }
      });
    });
  });

  describe('PUT /api/entries/bulk', () => {
    const mockUpdatedEntries = [
      {
        id: 'entry-1',
        userId: 'user-123',
        projectId: 'project-1',
        description: 'Bulk updated',
        startTime: new Date(),
        endTime: undefined,
        duration: 0,
        isRunning: false,
        tags: ['bulk'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    it('should bulk update entries successfully', async () => {
      mockService.bulkUpdateTimeEntries.mockResolvedValue(mockUpdatedEntries);

      const response = await request(app)
        .put('/api/entries/bulk')
        .send({
          entryIds: ['entry-1', 'entry-2'],
          updates: {
            description: 'Bulk updated',
            tags: ['bulk']
          }
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          entries: expect.any(Array),
          count: 1,
          message: '1 time entries updated successfully'
        }
      });

      expect(mockService.bulkUpdateTimeEntries).toHaveBeenCalledWith('user-123', {
        entryIds: ['entry-1', 'entry-2'],
        updates: {
          description: 'Bulk updated',
          tags: ['bulk']
        }
      });
    });

    it('should validate request body', async () => {
      await request(app)
        .put('/api/entries/bulk')
        .send({
          entryIds: [], // Empty array
          updates: {}
        })
        .expect(400);

      await request(app)
        .put('/api/entries/bulk')
        .send({
          entryIds: ['invalid-uuid'],
          updates: {}
        })
        .expect(400);
    });

    it('should handle entries not found error', async () => {
      mockService.bulkUpdateTimeEntries.mockRejectedValue(new Error('One or more time entries not found or not accessible'));

      const response = await request(app)
        .put('/api/entries/bulk')
        .send({
          entryIds: ['entry-1', 'entry-2'],
          updates: { description: 'Updated' }
        })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'ENTRIES_NOT_FOUND',
          message: 'One or more time entries not found or not accessible'
        }
      });
    });
  });

  describe('DELETE /api/entries/bulk', () => {
    it('should bulk delete entries successfully', async () => {
      mockService.bulkDeleteTimeEntries.mockResolvedValue();

      const response = await request(app)
        .delete('/api/entries/bulk')
        .send({
          entryIds: ['entry-1', 'entry-2', 'entry-3']
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          count: 3,
          message: '3 time entries deleted successfully'
        }
      });

      expect(mockService.bulkDeleteTimeEntries).toHaveBeenCalledWith('user-123', {
        entryIds: ['entry-1', 'entry-2', 'entry-3']
      });
    });

    it('should validate request body', async () => {
      await request(app)
        .delete('/api/entries/bulk')
        .send({
          entryIds: [] // Empty array
        })
        .expect(400);

      await request(app)
        .delete('/api/entries/bulk')
        .send({
          entryIds: ['invalid-uuid']
        })
        .expect(400);
    });

    it('should handle entries not found error', async () => {
      mockService.bulkDeleteTimeEntries.mockRejectedValue(new Error('One or more time entries not found or not accessible'));

      const response = await request(app)
        .delete('/api/entries/bulk')
        .send({
          entryIds: ['entry-1', 'entry-2']
        })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'ENTRIES_NOT_FOUND',
          message: 'One or more time entries not found or not accessible'
        }
      });
    });
  });
});