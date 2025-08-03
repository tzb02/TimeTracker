import { TimeEntryService, TimeEntryFilters, BulkUpdateRequest, BulkDeleteRequest } from '../timeEntryService';
import { getDatabase } from '../../database';
import { CreateTimeEntryRequest, UpdateTimeEntryRequest } from '../../types/models';

// Mock the database connection
jest.mock('../../database');
const mockDb = {
  query: jest.fn()
};
(getDatabase as jest.Mock).mockReturnValue(mockDb);

describe('TimeEntryService', () => {
  let service: TimeEntryService;
  const mockUserId = 'user-123';
  const mockProjectId = 'project-456';
  const mockEntryId = 'entry-789';

  beforeEach(() => {
    service = new TimeEntryService();
    jest.clearAllMocks();
  });

  describe('createTimeEntry', () => {
    const mockRequest: CreateTimeEntryRequest = {
      projectId: mockProjectId,
      description: 'Test task',
      startTime: new Date('2024-01-01T10:00:00Z')
    };

    it('should create a time entry successfully', async () => {
      // Mock project ownership check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: mockProjectId }]
      });

      // Mock running timer check
      mockDb.query.mockResolvedValueOnce({
        rows: []
      });

      // Mock time entry creation
      const mockTimeEntryRow = {
        id: mockEntryId,
        user_id: mockUserId,
        project_id: mockProjectId,
        description: 'Test task',
        start_time: new Date('2024-01-01T10:00:00Z'),
        end_time: null,
        duration: 0,
        is_running: false,
        tags: [],
        created_at: new Date(),
        updated_at: new Date()
      };
      mockDb.query.mockResolvedValueOnce({
        rows: [mockTimeEntryRow]
      });

      const result = await service.createTimeEntry(mockUserId, mockRequest);

      expect(result).toEqual({
        id: mockEntryId,
        userId: mockUserId,
        projectId: mockProjectId,
        description: 'Test task',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: null,
        duration: 0,
        isRunning: false,
        tags: [],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });

      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it('should throw error if project not found', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: []
      });

      await expect(service.createTimeEntry(mockUserId, mockRequest))
        .rejects.toThrow('Project not found or not accessible');
    });

    it('should throw error if timer is already running', async () => {
      // Mock project ownership check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: mockProjectId }]
      });

      // Mock running timer check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'running-entry' }]
      });

      await expect(service.createTimeEntry(mockUserId, mockRequest))
        .rejects.toThrow('Cannot create time entry while another timer is running');
    });

    it('should use current time if startTime not provided', async () => {
      const requestWithoutTime = { ...mockRequest };
      delete requestWithoutTime.startTime;

      // Mock project ownership check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: mockProjectId }]
      });

      // Mock running timer check
      mockDb.query.mockResolvedValueOnce({
        rows: []
      });

      // Mock time entry creation
      const mockTimeEntryRow = {
        id: mockEntryId,
        user_id: mockUserId,
        project_id: mockProjectId,
        description: 'Test task',
        start_time: expect.any(Date),
        end_time: null,
        duration: 0,
        is_running: false,
        tags: [],
        created_at: new Date(),
        updated_at: new Date()
      };
      mockDb.query.mockResolvedValueOnce({
        rows: [mockTimeEntryRow]
      });

      await service.createTimeEntry(mockUserId, requestWithoutTime);

      expect(mockDb.query).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.arrayContaining([
          mockUserId,
          mockProjectId,
          'Test task',
          expect.any(Date), // Should be current time
          null,
          0,
          false,
          []
        ])
      );
    });
  });

  describe('getTimeEntries', () => {
    const mockTimeEntryRows = [
      {
        id: 'entry-1',
        user_id: mockUserId,
        project_id: mockProjectId,
        description: 'Task 1',
        start_time: new Date('2024-01-01T10:00:00Z'),
        end_time: new Date('2024-01-01T11:00:00Z'),
        duration: 3600,
        is_running: false,
        tags: ['tag1'],
        created_at: new Date(),
        updated_at: new Date(),
        project_name: 'Test Project',
        project_color: '#3B82F6'
      }
    ];

    it('should get time entries with default parameters', async () => {
      // Mock count query
      mockDb.query.mockResolvedValueOnce({
        rows: [{ count: '1' }]
      });

      // Mock entries query
      mockDb.query.mockResolvedValueOnce({
        rows: mockTimeEntryRows
      });

      const result = await service.getTimeEntries(mockUserId);

      expect(result.total).toBe(1);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual({
        id: 'entry-1',
        userId: mockUserId,
        projectId: mockProjectId,
        description: 'Task 1',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T11:00:00Z'),
        duration: 3600,
        isRunning: false,
        tags: ['tag1'],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        projectName: 'Test Project',
        projectColor: '#3B82F6'
      });
    });

    it('should apply filters correctly', async () => {
      const filters: TimeEntryFilters = {
        projectId: mockProjectId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        isRunning: false,
        tags: ['tag1'],
        search: 'test'
      };

      // Mock count query
      mockDb.query.mockResolvedValueOnce({
        rows: [{ count: '1' }]
      });

      // Mock entries query
      mockDb.query.mockResolvedValueOnce({
        rows: mockTimeEntryRows
      });

      await service.getTimeEntries(mockUserId, filters, 25, 10);

      // Verify the query includes all filters
      const lastCall = mockDb.query.mock.calls[1];
      expect(lastCall[0]).toContain('te.project_id = $2');
      expect(lastCall[0]).toContain('te.start_time >= $3');
      expect(lastCall[0]).toContain('te.start_time <= $4');
      expect(lastCall[0]).toContain('te.is_running = $5');
      expect(lastCall[0]).toContain('te.tags && $6');
      expect(lastCall[0]).toContain('te.description ILIKE $7');
      expect(lastCall[0]).toContain('LIMIT $10 OFFSET $11');

      expect(lastCall[1]).toEqual([
        mockUserId,
        mockProjectId,
        filters.startDate,
        filters.endDate,
        false,
        ['tag1'],
        '%test%',
        '%test%',
        25,
        10
      ]);
    });
  });

  describe('getTimeEntryById', () => {
    it('should return time entry if found', async () => {
      const mockTimeEntryRow = {
        id: mockEntryId,
        user_id: mockUserId,
        project_id: mockProjectId,
        description: 'Test task',
        start_time: new Date('2024-01-01T10:00:00Z'),
        end_time: null,
        duration: 0,
        is_running: false,
        tags: [],
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [mockTimeEntryRow]
      });

      const result = await service.getTimeEntryById(mockUserId, mockEntryId);

      expect(result).toEqual({
        id: mockEntryId,
        userId: mockUserId,
        projectId: mockProjectId,
        description: 'Test task',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: null,
        duration: 0,
        isRunning: false,
        tags: [],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });
    });

    it('should return null if entry not found', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: []
      });

      const result = await service.getTimeEntryById(mockUserId, mockEntryId);

      expect(result).toBeNull();
    });
  });

  describe('updateTimeEntry', () => {
    const mockExistingEntry = {
      id: mockEntryId,
      userId: mockUserId,
      projectId: mockProjectId,
      description: 'Original task',
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: undefined,
      duration: 0,
      isRunning: false,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    beforeEach(() => {
      // Mock getTimeEntryById
      jest.spyOn(service, 'getTimeEntryById').mockResolvedValue(mockExistingEntry);
    });

    it('should update time entry successfully', async () => {
      const updateRequest: UpdateTimeEntryRequest = {
        description: 'Updated task',
        tags: ['new-tag']
      };

      const mockUpdatedRow = {
        id: mockEntryId,
        user_id: mockUserId,
        project_id: mockProjectId,
        description: 'Updated task',
        start_time: new Date('2024-01-01T10:00:00Z'),
        end_time: null,
        duration: 0,
        is_running: false,
        tags: ['new-tag'],
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [mockUpdatedRow]
      });

      const result = await service.updateTimeEntry(mockUserId, mockEntryId, updateRequest);

      expect(result.description).toBe('Updated task');
      expect(result.tags).toEqual(['new-tag']);
    });

    it('should validate project ownership when changing project', async () => {
      const newProjectId = 'new-project-123';
      const updateRequest: UpdateTimeEntryRequest = {
        projectId: newProjectId
      };

      // Mock project ownership check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: newProjectId }]
      });

      // Mock update query
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          ...mockExistingEntry,
          project_id: newProjectId
        }]
      });

      await service.updateTimeEntry(mockUserId, mockEntryId, updateRequest);

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [newProjectId, mockUserId]
      );
    });

    it('should throw error if project not accessible when changing project', async () => {
      const updateRequest: UpdateTimeEntryRequest = {
        projectId: 'invalid-project'
      };

      // Mock project ownership check failure
      mockDb.query.mockResolvedValueOnce({
        rows: []
      });

      await expect(service.updateTimeEntry(mockUserId, mockEntryId, updateRequest))
        .rejects.toThrow('Project not found or not accessible');
    });

    it('should validate time constraints', async () => {
      const updateRequest: UpdateTimeEntryRequest = {
        startTime: new Date('2024-01-01T12:00:00Z'),
        endTime: new Date('2024-01-01T11:00:00Z') // End before start
      };

      await expect(service.updateTimeEntry(mockUserId, mockEntryId, updateRequest))
        .rejects.toThrow('End time must be after start time');
    });

    it('should calculate duration when both start and end times provided', async () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T11:30:00Z');
      const expectedDuration = 5400; // 1.5 hours in seconds

      const updateRequest: UpdateTimeEntryRequest = {
        startTime,
        endTime
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          ...mockExistingEntry,
          start_time: startTime,
          end_time: endTime,
          duration: expectedDuration
        }]
      });

      await service.updateTimeEntry(mockUserId, mockEntryId, updateRequest);

      // Verify duration was calculated and included in update
      const updateCall = mockDb.query.mock.calls[0];
      expect(updateCall[0]).toContain('duration = $');
      expect(updateCall[1]).toContain(expectedDuration);
    });

    it('should return existing entry if no changes', async () => {
      const result = await service.updateTimeEntry(mockUserId, mockEntryId, {});

      expect(result).toEqual(mockExistingEntry);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should throw error if entry not found', async () => {
      jest.spyOn(service, 'getTimeEntryById').mockResolvedValue(null);

      await expect(service.updateTimeEntry(mockUserId, mockEntryId, {}))
        .rejects.toThrow('Time entry not found or not accessible');
    });
  });

  describe('deleteTimeEntry', () => {
    it('should delete time entry successfully', async () => {
      const mockEntry = {
        id: mockEntryId,
        userId: mockUserId,
        projectId: mockProjectId,
        description: 'Test task',
        startTime: new Date(),
        endTime: undefined,
        duration: 0,
        isRunning: false,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      jest.spyOn(service, 'getTimeEntryById').mockResolvedValue(mockEntry);
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await service.deleteTimeEntry(mockUserId, mockEntryId);

      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM time_entries WHERE id = $1 AND user_id = $2',
        [mockEntryId, mockUserId]
      );
    });

    it('should throw error if entry not found', async () => {
      jest.spyOn(service, 'getTimeEntryById').mockResolvedValue(null);

      await expect(service.deleteTimeEntry(mockUserId, mockEntryId))
        .rejects.toThrow('Time entry not found or not accessible');
    });
  });

  describe('bulkUpdateTimeEntries', () => {
    const entryIds = ['entry-1', 'entry-2', 'entry-3'];
    const bulkRequest: BulkUpdateRequest = {
      entryIds,
      updates: {
        description: 'Bulk updated',
        tags: ['bulk-tag']
      }
    };

    it('should bulk update entries successfully', async () => {
      // Mock ownership check
      mockDb.query.mockResolvedValueOnce({
        rows: entryIds.map(id => ({ id }))
      });

      // Mock update query
      const mockUpdatedRows = entryIds.map(id => ({
        id,
        user_id: mockUserId,
        project_id: mockProjectId,
        description: 'Bulk updated',
        start_time: new Date(),
        end_time: null,
        duration: 0,
        is_running: false,
        tags: ['bulk-tag'],
        created_at: new Date(),
        updated_at: new Date()
      }));

      mockDb.query.mockResolvedValueOnce({
        rows: mockUpdatedRows
      });

      const result = await service.bulkUpdateTimeEntries(mockUserId, bulkRequest);

      expect(result).toHaveLength(3);
      expect(result[0].description).toBe('Bulk updated');
      expect(result[0].tags).toEqual(['bulk-tag']);
    });

    it('should return empty array for empty entry IDs', async () => {
      const emptyRequest: BulkUpdateRequest = {
        entryIds: [],
        updates: { description: 'test' }
      };

      const result = await service.bulkUpdateTimeEntries(mockUserId, emptyRequest);

      expect(result).toEqual([]);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should throw error if not all entries are accessible', async () => {
      // Mock ownership check - only 2 out of 3 entries found
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'entry-1' }, { id: 'entry-2' }]
      });

      await expect(service.bulkUpdateTimeEntries(mockUserId, bulkRequest))
        .rejects.toThrow('One or more time entries not found or not accessible');
    });

    it('should validate project ownership when updating project', async () => {
      const requestWithProject: BulkUpdateRequest = {
        entryIds,
        updates: { projectId: 'new-project' }
      };

      // Mock ownership check
      mockDb.query.mockResolvedValueOnce({
        rows: entryIds.map(id => ({ id }))
      });

      // Mock project check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'new-project' }]
      });

      // Mock update query
      mockDb.query.mockResolvedValueOnce({
        rows: []
      });

      await service.bulkUpdateTimeEntries(mockUserId, requestWithProject);

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        ['new-project', mockUserId]
      );
    });
  });

  describe('bulkDeleteTimeEntries', () => {
    const entryIds = ['entry-1', 'entry-2', 'entry-3'];
    const bulkRequest: BulkDeleteRequest = {
      entryIds
    };

    it('should bulk delete entries successfully', async () => {
      // Mock ownership check
      mockDb.query.mockResolvedValueOnce({
        rows: entryIds.map(id => ({ id }))
      });

      // Mock delete query
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await service.bulkDeleteTimeEntries(mockUserId, bulkRequest);

      expect(mockDb.query).toHaveBeenLastCalledWith(
        'DELETE FROM time_entries WHERE id = ANY($1) AND user_id = $2',
        [entryIds, mockUserId]
      );
    });

    it('should return early for empty entry IDs', async () => {
      const emptyRequest: BulkDeleteRequest = {
        entryIds: []
      };

      await service.bulkDeleteTimeEntries(mockUserId, emptyRequest);

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should throw error if not all entries are accessible', async () => {
      // Mock ownership check - only 2 out of 3 entries found
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'entry-1' }, { id: 'entry-2' }]
      });

      await expect(service.bulkDeleteTimeEntries(mockUserId, bulkRequest))
        .rejects.toThrow('One or more time entries not found or not accessible');
    });
  });

  describe('getTimeEntryStats', () => {
    it('should return statistics correctly', async () => {
      const mockStatsRow = {
        total_entries: '10',
        total_duration: '36000', // 10 hours
        average_duration: '3600', // 1 hour
        longest_entry: '7200', // 2 hours
        shortest_entry: '1800' // 30 minutes
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [mockStatsRow]
      });

      const result = await service.getTimeEntryStats(mockUserId);

      expect(result).toEqual({
        totalEntries: 10,
        totalDuration: 36000,
        averageDuration: 3600,
        longestEntry: 7200,
        shortestEntry: 1800
      });
    });

    it('should handle empty results', async () => {
      const mockEmptyStatsRow = {
        total_entries: '0',
        total_duration: null,
        average_duration: null,
        longest_entry: null,
        shortest_entry: null
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [mockEmptyStatsRow]
      });

      const result = await service.getTimeEntryStats(mockUserId);

      expect(result).toEqual({
        totalEntries: 0,
        totalDuration: 0,
        averageDuration: 0,
        longestEntry: 0,
        shortestEntry: 0
      });
    });

    it('should apply filters to stats query', async () => {
      const filters: TimeEntryFilters = {
        projectId: mockProjectId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          total_entries: '5',
          total_duration: '18000',
          average_duration: '3600',
          longest_entry: '7200',
          shortest_entry: '1800'
        }]
      });

      await service.getTimeEntryStats(mockUserId, filters);

      const queryCall = mockDb.query.mock.calls[0];
      expect(queryCall[0]).toContain('te.project_id = $2');
      expect(queryCall[0]).toContain('te.start_time >= $3');
      expect(queryCall[0]).toContain('te.start_time <= $4');
      expect(queryCall[1]).toEqual([
        mockUserId,
        mockProjectId,
        filters.startDate,
        filters.endDate
      ]);
    });
  });

  describe('searchTimeEntries', () => {
    it('should search entries by description and project name', async () => {
      const searchTerm = 'test';
      const mockSearchResults = [
        {
          id: 'entry-1',
          user_id: mockUserId,
          project_id: mockProjectId,
          description: 'Test task',
          start_time: new Date(),
          end_time: null,
          duration: 0,
          is_running: false,
          tags: [],
          created_at: new Date(),
          updated_at: new Date(),
          project_name: 'Test Project',
          project_color: '#3B82F6'
        }
      ];

      // Mock search query
      mockDb.query.mockResolvedValueOnce({
        rows: mockSearchResults
      });

      // Mock count query
      mockDb.query.mockResolvedValueOnce({
        rows: [{ count: '1' }]
      });

      const result = await service.searchTimeEntries(mockUserId, searchTerm, 25, 0);

      expect(result.entries).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.entries[0].description).toBe('Test task');
      expect((result.entries[0] as any).projectName).toBe('Test Project');

      // Verify search pattern
      const searchCall = mockDb.query.mock.calls[0];
      expect(searchCall[1]).toContain(`%${searchTerm}%`);
    });
  });

  describe('getTimeEntriesByProject', () => {
    it('should group entries by project', async () => {
      const mockGroupedResults = [
        {
          id: 'entry-1',
          user_id: mockUserId,
          project_id: 'project-1',
          description: 'Task 1',
          start_time: new Date(),
          end_time: null,
          duration: 3600,
          is_running: false,
          tags: [],
          created_at: new Date(),
          updated_at: new Date(),
          project_name: 'Project A',
          project_color: '#3B82F6'
        },
        {
          id: 'entry-2',
          user_id: mockUserId,
          project_id: 'project-1',
          description: 'Task 2',
          start_time: new Date(),
          end_time: null,
          duration: 1800,
          is_running: false,
          tags: [],
          created_at: new Date(),
          updated_at: new Date(),
          project_name: 'Project A',
          project_color: '#3B82F6'
        },
        {
          id: 'entry-3',
          user_id: mockUserId,
          project_id: 'project-2',
          description: 'Task 3',
          start_time: new Date(),
          end_time: null,
          duration: 2400,
          is_running: false,
          tags: [],
          created_at: new Date(),
          updated_at: new Date(),
          project_name: 'Project B',
          project_color: '#EF4444'
        }
      ];

      mockDb.query.mockResolvedValueOnce({
        rows: mockGroupedResults
      });

      const result = await service.getTimeEntriesByProject(mockUserId);

      expect(result).toHaveLength(2);
      
      const projectA = result.find(p => p.projectId === 'project-1');
      expect(projectA).toBeDefined();
      expect(projectA!.entries).toHaveLength(2);
      expect(projectA!.totalDuration).toBe(5400); // 3600 + 1800
      expect(projectA!.projectName).toBe('Project A');

      const projectB = result.find(p => p.projectId === 'project-2');
      expect(projectB).toBeDefined();
      expect(projectB!.entries).toHaveLength(1);
      expect(projectB!.totalDuration).toBe(2400);
      expect(projectB!.projectName).toBe('Project B');
    });
  });

  describe('validateTimeEntryOwnership', () => {
    it('should return true if entry belongs to user', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: mockEntryId }]
      });

      const result = await service.validateTimeEntryOwnership(mockUserId, mockEntryId);

      expect(result).toBe(true);
    });

    it('should return false if entry does not belong to user', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: []
      });

      const result = await service.validateTimeEntryOwnership(mockUserId, mockEntryId);

      expect(result).toBe(false);
    });
  });

  describe('getRunningTimeEntry', () => {
    it('should return running entry if exists', async () => {
      const mockRunningEntry = {
        id: mockEntryId,
        user_id: mockUserId,
        project_id: mockProjectId,
        description: 'Running task',
        start_time: new Date(),
        end_time: null,
        duration: 0,
        is_running: true,
        tags: [],
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [mockRunningEntry]
      });

      const result = await service.getRunningTimeEntry(mockUserId);

      expect(result).toBeDefined();
      expect(result!.isRunning).toBe(true);
      expect(result!.description).toBe('Running task');
    });

    it('should return null if no running entry', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: []
      });

      const result = await service.getRunningTimeEntry(mockUserId);

      expect(result).toBeNull();
    });
  });
});