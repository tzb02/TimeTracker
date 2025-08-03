import { ReportService, ReportFilters } from '../reportService';
import { getDatabase } from '../../database';

// Mock database connection
jest.mock('../../database');
const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('ReportService', () => {
  let reportService: ReportService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {
      query: jest.fn()
    };
    
    mockGetDatabase.mockReturnValue(mockDb);
    reportService = new ReportService();
  });

  describe('generateTimeReport', () => {
    const mockTimeEntries = [
      {
        id: 'entry-1',
        user_id: 'user-123',
        project_id: 'proj-1',
        project_name: 'Project A',
        project_color: '#3b82f6',
        description: 'Task 1',
        start_time: new Date('2024-01-15T09:00:00Z'),
        end_time: new Date('2024-01-15T10:30:00Z'),
        duration: 5400, // 1.5 hours
        tags: ['development', 'frontend'],
        is_running: false
      },
      {
        id: 'entry-2',
        user_id: 'user-123',
        project_id: 'proj-2',
        project_name: 'Project B',
        project_color: '#ef4444',
        description: 'Task 2',
        start_time: new Date('2024-01-15T14:00:00Z'),
        end_time: new Date('2024-01-15T15:00:00Z'),
        duration: 3600, // 1 hour
        tags: ['development', 'backend'],
        is_running: false
      }
    ];

    it('should generate comprehensive time report', async () => {
      mockDb.query.mockResolvedValue({ rows: mockTimeEntries });

      const result = await reportService.generateTimeReport('user-123');

      expect(result).toEqual({
        totalDuration: 9000, // 2.5 hours
        totalEntries: 2,
        averageDuration: 4500, // 1.25 hours
        longestEntry: 5400,
        shortestEntry: 3600,
        projectBreakdown: [
          {
            projectId: 'proj-1',
            projectName: 'Project A',
            projectColor: '#3b82f6',
            totalDuration: 5400,
            entryCount: 1,
            percentage: 60
          },
          {
            projectId: 'proj-2',
            projectName: 'Project B',
            projectColor: '#ef4444',
            totalDuration: 3600,
            entryCount: 1,
            percentage: 40
          }
        ],
        dailyBreakdown: [
          {
            date: '2024-01-15',
            totalDuration: 9000,
            entryCount: 2,
            projects: [
              {
                projectId: 'proj-1',
                projectName: 'Project A',
                projectColor: '#3b82f6',
                duration: 5400
              },
              {
                projectId: 'proj-2',
                projectName: 'Project B',
                projectColor: '#ef4444',
                duration: 3600
              }
            ]
          }
        ],
        tagBreakdown: [
          {
            tag: 'development',
            totalDuration: 9000,
            entryCount: 2,
            percentage: 100
          },
          {
            tag: 'frontend',
            totalDuration: 5400,
            entryCount: 1,
            percentage: 60
          },
          {
            tag: 'backend',
            totalDuration: 3600,
            entryCount: 1,
            percentage: 40
          }
        ]
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['user-123']
      );
    });

    it('should handle empty results', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await reportService.generateTimeReport('user-123');

      expect(result).toEqual({
        totalDuration: 0,
        totalEntries: 0,
        averageDuration: 0,
        longestEntry: 0,
        shortestEntry: 0,
        projectBreakdown: [],
        dailyBreakdown: [],
        tagBreakdown: []
      });
    });

    it('should apply date range filter', async () => {
      const filters: ReportFilters = {
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31')
        }
      };

      mockDb.query.mockResolvedValue({ rows: mockTimeEntries });

      await reportService.generateTimeReport('user-123', filters);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND te.start_time >= $2 AND te.start_time <= $3'),
        ['user-123', filters.dateRange!.startDate, filters.dateRange!.endDate]
      );
    });

    it('should apply project filter', async () => {
      const filters: ReportFilters = {
        projectIds: ['proj-1', 'proj-2']
      };

      mockDb.query.mockResolvedValue({ rows: mockTimeEntries });

      await reportService.generateTimeReport('user-123', filters);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND te.project_id = ANY($2)'),
        ['user-123', filters.projectIds]
      );
    });

    it('should apply tag filter', async () => {
      const filters: ReportFilters = {
        tags: ['development', 'frontend']
      };

      mockDb.query.mockResolvedValue({ rows: mockTimeEntries });

      await reportService.generateTimeReport('user-123', filters);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND te.tags && $2'),
        ['user-123', filters.tags]
      );
    });

    it('should apply multiple filters', async () => {
      const filters: ReportFilters = {
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31')
        },
        projectIds: ['proj-1'],
        tags: ['development']
      };

      mockDb.query.mockResolvedValue({ rows: mockTimeEntries });

      await reportService.generateTimeReport('user-123', filters);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND te.project_id = ANY($2)'),
        ['user-123', filters.projectIds, filters.tags, filters.dateRange!.startDate, filters.dateRange!.endDate]
      );
    });
  });

  describe('generateWeeklyReport', () => {
    const mockWeeklyEntries = [
      {
        id: 'entry-1',
        project_id: 'proj-1',
        project_name: 'Project A',
        project_color: '#3b82f6',
        start_time: new Date('2024-01-15T09:00:00Z'),
        duration: 7200,
        is_running: false
      },
      {
        id: 'entry-2',
        project_id: 'proj-1',
        project_name: 'Project A',
        project_color: '#3b82f6',
        start_time: new Date('2024-01-16T10:00:00Z'),
        duration: 5400,
        is_running: false
      }
    ];

    it('should generate weekly report', async () => {
      const weekStart = new Date('2024-01-15T00:00:00Z');
      
      // Mock the main query
      mockDb.query.mockResolvedValueOnce({ rows: mockWeeklyEntries });
      
      // Mock productivity metrics query
      mockDb.query.mockResolvedValueOnce({ 
        rows: mockWeeklyEntries.map(entry => ({
          ...entry,
          start_hour: entry.start_time.getHours(),
          day_of_week: entry.start_time.getDay(),
          entry_date: entry.start_time
        }))
      });

      const result = await reportService.generateWeeklyReport('user-123', weekStart);

      expect(result.weekStart).toEqual(weekStart);
      expect(result.totalDuration).toBe(12600);
      expect(result.topProjects).toHaveLength(1);
      expect(result.topProjects[0]).toEqual({
        projectId: 'proj-1',
        projectName: 'Project A',
        duration: 12600,
        percentage: 100
      });
      expect(result.dailyBreakdown).toHaveLength(7); // Full week
    });

    it('should handle empty week', async () => {
      const weekStart = new Date('2024-01-15T00:00:00Z');
      
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await reportService.generateWeeklyReport('user-123', weekStart);

      expect(result.totalDuration).toBe(0);
      expect(result.topProjects).toHaveLength(0);
      expect(result.dailyBreakdown).toHaveLength(7);
    });
  });

  describe('generateMonthlyReport', () => {
    const mockMonthlyEntries = [
      {
        id: 'entry-1',
        project_id: 'proj-1',
        project_name: 'Project A',
        project_color: '#3b82f6',
        start_time: new Date('2024-01-15T09:00:00Z'),
        duration: 28800, // 8 hours
        is_running: false
      }
    ];

    it('should generate monthly report', async () => {
      // Mock main query
      mockDb.query.mockResolvedValueOnce({ rows: mockMonthlyEntries });
      
      // Mock productivity metrics query
      mockDb.query.mockResolvedValueOnce({ 
        rows: mockMonthlyEntries.map(entry => ({
          ...entry,
          start_hour: entry.start_time.getHours(),
          day_of_week: entry.start_time.getDay(),
          entry_date: entry.start_time
        }))
      });

      // Mock previous month query for comparison
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await reportService.generateMonthlyReport('user-123', 1, 2024);

      expect(result.month).toBe(1);
      expect(result.year).toBe(2024);
      expect(result.totalDuration).toBe(28800);
      expect(result.projectBreakdown).toHaveLength(1);
      expect(result.comparison.previousMonth.totalDuration).toBe(0);
    });
  });

  describe('calculateProductivityMetrics', () => {
    const mockProductivityEntries = [
      {
        duration: 3600,
        start_hour: '9',
        day_of_week: '1', // Monday
        entry_date: new Date('2024-01-15')
      },
      {
        duration: 5400,
        start_hour: '10',
        day_of_week: '2', // Tuesday
        entry_date: new Date('2024-01-16')
      },
      {
        duration: 7200,
        start_hour: '10',
        day_of_week: '3', // Wednesday
        entry_date: new Date('2024-01-17')
      }
    ];

    it('should calculate productivity metrics', async () => {
      mockDb.query.mockResolvedValue({ rows: mockProductivityEntries });

      const dateRange = {
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-17')
      };

      const result = await reportService.calculateProductivityMetrics('user-123', dateRange);

      expect(result.averageSessionLength).toBe(5400); // Average of 3600, 5400, 7200
      expect(result.totalSessions).toBe(3);
      expect(result.mostProductiveHour).toBe(10); // Hour 10 has 12600 seconds total
      expect(result.mostProductiveDay).toBe('Wednesday'); // Day 3 has 7200 seconds
      expect(result.focusScore).toBeGreaterThan(0);
      expect(result.streakDays).toBeGreaterThan(0);
    });

    it('should handle empty productivity data', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const dateRange = {
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-17')
      };

      const result = await reportService.calculateProductivityMetrics('user-123', dateRange);

      expect(result).toEqual({
        averageSessionLength: 0,
        totalSessions: 0,
        mostProductiveHour: 9,
        mostProductiveDay: 'Monday',
        focusScore: 0,
        streakDays: 0
      });
    });
  });

  describe('exportTimeEntries', () => {
    const mockExportEntries = [
      {
        start_time: new Date('2024-01-15T09:00:00Z'),
        end_time: new Date('2024-01-15T10:30:00Z'),
        project_name: 'Project A',
        description: 'Task 1',
        duration: 5400,
        tags: ['development', 'frontend']
      },
      {
        start_time: new Date('2024-01-15T14:00:00Z'),
        end_time: new Date('2024-01-15T15:00:00Z'),
        project_name: 'Project B',
        description: 'Task 2',
        duration: 3600,
        tags: ['development']
      }
    ];

    it('should export time entries as CSV', async () => {
      mockDb.query.mockResolvedValue({ rows: mockExportEntries });

      const result = await reportService.exportTimeEntries('user-123');

      expect(result).toContain('Date,Project,Description,Start Time,End Time,Duration (hours),Tags');
      expect(result).toContain('2024-01-15,"Project A","Task 1"');
      expect(result).toContain('1.50'); // 5400 seconds = 1.5 hours
      expect(result).toContain('"development, frontend"');
    });

    it('should handle empty export data', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await reportService.exportTimeEntries('user-123');

      expect(result).toBe('Date,Project,Description,Start Time,End Time,Duration (hours),Tags');
    });
  });

  describe('getDashboardSummary', () => {
    it('should generate dashboard summary', async () => {
      // Mock today's data
      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ duration: '7200', entries: '3' }] 
      });
      
      // Mock this week's data
      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ duration: '28800', entries: '12' }] 
      });
      
      // Mock this month's data
      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ duration: '144000', entries: '60' }] 
      });
      
      // Mock top projects
      mockDb.query.mockResolvedValueOnce({ 
        rows: [
          { name: 'Project A', color: '#3b82f6', duration: '86400' },
          { name: 'Project B', color: '#ef4444', duration: '57600' }
        ] 
      });

      const result = await reportService.getDashboardSummary('user-123');

      expect(result).toEqual({
        today: { duration: 7200, entries: 3 },
        thisWeek: { duration: 28800, entries: 12 },
        thisMonth: { duration: 144000, entries: 60 },
        topProjects: [
          { name: 'Project A', duration: 86400, color: '#3b82f6' },
          { name: 'Project B', duration: 57600, color: '#ef4444' }
        ]
      });

      expect(mockDb.query).toHaveBeenCalledTimes(4);
    });
  });
});