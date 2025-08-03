import request from 'supertest';
import express from 'express';
import reportRoutes from '../reports';
import { ReportService } from '../../services/reportService';
import { ExportService } from '../../services/exportService';
import { CacheService } from '../../services/cacheService';

// Mock services
jest.mock('../../services/reportService');
jest.mock('../../services/exportService');
jest.mock('../../services/cacheService');

const MockedReportService = ReportService as jest.MockedClass<typeof ReportService>;
const MockedExportService = ExportService as jest.MockedClass<typeof ExportService>;
const MockedCacheService = CacheService as jest.MockedClass<typeof CacheService>;

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { userId: 'user-123', email: 'test@example.com', role: 'user' };
    next();
  }
}));

describe('Report Routes', () => {
  let app: express.Application;
  let mockReportService: jest.Mocked<ReportService>;
  let mockExportService: jest.Mocked<ExportService>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock service instances
    mockReportService = new MockedReportService() as jest.Mocked<ReportService>;
    mockExportService = new MockedExportService() as jest.Mocked<ExportService>;
    mockCacheService = new MockedCacheService() as jest.Mocked<CacheService>;

    // Mock constructors
    MockedReportService.mockImplementation(() => mockReportService);
    MockedExportService.mockImplementation(() => mockExportService);
    MockedCacheService.mockImplementation(() => mockCacheService);

    // Setup express app
    app = express();
    app.use(express.json());
    app.use('/api/reports', reportRoutes);
  });

  describe('GET /api/reports/time', () => {
    const mockTimeReport = {
      totalDuration: 7200,
      totalEntries: 3,
      averageDuration: 2400,
      longestEntry: 3600,
      shortestEntry: 1800,
      projectBreakdown: [],
      dailyBreakdown: [],
      tagBreakdown: []
    };

    it('should generate time report successfully', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue(true);
      mockReportService.generateTimeReport.mockResolvedValue(mockTimeReport);

      const response = await request(app)
        .get('/api/reports/time')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockTimeReport,
        cached: false
      });

      expect(mockReportService.generateTimeReport).toHaveBeenCalledWith('user-123', {});
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should return cached report if available', async () => {
      mockCacheService.get.mockResolvedValue(mockTimeReport);

      const response = await request(app)
        .get('/api/reports/time')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockTimeReport,
        cached: true
      });

      expect(mockReportService.generateTimeReport).not.toHaveBeenCalled();
    });

    it('should handle date range filters', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue(true);
      mockReportService.generateTimeReport.mockResolvedValue(mockTimeReport);

      const response = await request(app)
        .get('/api/reports/time')
        .query({
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-31T23:59:59.999Z'
        })
        .expect(200);

      expect(mockReportService.generateTimeReport).toHaveBeenCalledWith('user-123', {
        dateRange: {
          startDate: new Date('2024-01-01T00:00:00.000Z'),
          endDate: new Date('2024-01-31T23:59:59.999Z')
        }
      });
    });

    it('should handle project and tag filters', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue(true);
      mockReportService.generateTimeReport.mockResolvedValue(mockTimeReport);

      const response = await request(app)
        .get('/api/reports/time')
        .query({
          projectIds: ['proj-1', 'proj-2'],
          tags: ['tag1', 'tag2'],
          groupBy: 'project'
        })
        .expect(200);

      expect(mockReportService.generateTimeReport).toHaveBeenCalledWith('user-123', {
        projectIds: ['proj-1', 'proj-2'],
        tags: ['tag1', 'tag2'],
        groupBy: 'project'
      });
    });

    it('should validate date format', async () => {
      const response = await request(app)
        .get('/api/reports/time')
        .query({
          startDate: 'invalid-date'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate groupBy parameter', async () => {
      const response = await request(app)
        .get('/api/reports/time')
        .query({
          groupBy: 'invalid-group'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle service errors', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockReportService.generateTimeReport.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/reports/time')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate time report'
        }
      });
    });
  });

  describe('GET /api/reports/weekly', () => {
    const mockWeeklyReport = {
      weekStart: new Date('2024-01-15'),
      weekEnd: new Date('2024-01-21'),
      totalDuration: 14400,
      dailyBreakdown: [],
      topProjects: [],
      productivity: {
        averageSessionLength: 2400,
        totalSessions: 6,
        mostProductiveHour: 10,
        mostProductiveDay: 'Tuesday',
        focusScore: 85,
        streakDays: 5
      }
    };

    it('should generate weekly report successfully', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue(true);
      mockReportService.generateWeeklyReport.mockResolvedValue(mockWeeklyReport);

      const response = await request(app)
        .get('/api/reports/weekly')
        .query({ weekStart: '2024-01-15T00:00:00.000Z' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockWeeklyReport,
        cached: false
      });

      expect(mockReportService.generateWeeklyReport).toHaveBeenCalledWith(
        'user-123',
        new Date('2024-01-15T00:00:00.000Z')
      );
    });

    it('should require weekStart parameter', async () => {
      const response = await request(app)
        .get('/api/reports/weekly')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate weekStart date format', async () => {
      const response = await request(app)
        .get('/api/reports/weekly')
        .query({ weekStart: 'invalid-date' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/reports/monthly', () => {
    const mockMonthlyReport = {
      month: 1,
      year: 2024,
      totalDuration: 57600,
      weeklyBreakdown: [],
      projectBreakdown: [],
      productivity: {
        averageSessionLength: 2400,
        totalSessions: 24,
        mostProductiveHour: 10,
        mostProductiveDay: 'Tuesday',
        focusScore: 85,
        streakDays: 15
      },
      comparison: {
        previousMonth: {
          totalDuration: 43200,
          percentageChange: 33
        }
      }
    };

    it('should generate monthly report successfully', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue(true);
      mockReportService.generateMonthlyReport.mockResolvedValue(mockMonthlyReport);

      const response = await request(app)
        .get('/api/reports/monthly')
        .query({ month: 1, year: 2024 })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockMonthlyReport,
        cached: false
      });

      expect(mockReportService.generateMonthlyReport).toHaveBeenCalledWith('user-123', 1, 2024);
    });

    it('should validate month parameter', async () => {
      const response = await request(app)
        .get('/api/reports/monthly')
        .query({ month: 13, year: 2024 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate year parameter', async () => {
      const response = await request(app)
        .get('/api/reports/monthly')
        .query({ month: 1, year: 2050 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/reports/dashboard', () => {
    const mockDashboardSummary = {
      today: { duration: 3600, entries: 2 },
      thisWeek: { duration: 14400, entries: 8 },
      thisMonth: { duration: 57600, entries: 32 },
      topProjects: [
        { name: 'Project A', duration: 28800, color: '#3b82f6' },
        { name: 'Project B', duration: 14400, color: '#ef4444' }
      ]
    };

    it('should generate dashboard summary successfully', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue(true);
      mockReportService.getDashboardSummary.mockResolvedValue(mockDashboardSummary);

      const response = await request(app)
        .get('/api/reports/dashboard')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockDashboardSummary,
        cached: false
      });

      expect(mockReportService.getDashboardSummary).toHaveBeenCalledWith('user-123');
    });

    it('should return cached dashboard summary', async () => {
      mockCacheService.get.mockResolvedValue(mockDashboardSummary);

      const response = await request(app)
        .get('/api/reports/dashboard')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockDashboardSummary,
        cached: true
      });

      expect(mockReportService.getDashboardSummary).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/reports/export', () => {
    it('should export CSV successfully', async () => {
      const csvData = 'Date,Project,Description\n2024-01-15,Project A,Task 1';
      mockExportService.exportToCSV.mockResolvedValue(csvData);

      const response = await request(app)
        .get('/api/reports/export')
        .query({ format: 'csv' })
        .expect(200);

      expect(response.text).toBe(csvData);
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toBe('attachment; filename="time-entries.csv"');
      expect(mockExportService.exportToCSV).toHaveBeenCalledWith('user-123', {});
    });

    it('should export PDF successfully', async () => {
      const pdfBuffer = Buffer.from('mock-pdf-content');
      mockExportService.exportToPDF.mockResolvedValue(pdfBuffer);

      const response = await request(app)
        .get('/api/reports/export')
        .query({ format: 'pdf' })
        .expect(200);

      expect(response.body).toEqual(pdfBuffer);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toBe('attachment; filename="time-report.pdf"');
      expect(mockExportService.exportToPDF).toHaveBeenCalledWith('user-123', {});
    });

    it('should handle export with filters', async () => {
      const csvData = 'filtered,data';
      mockExportService.exportToCSV.mockResolvedValue(csvData);

      await request(app)
        .get('/api/reports/export')
        .query({
          format: 'csv',
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-31T23:59:59.999Z',
          projectIds: ['proj-1'],
          tags: ['tag1']
        })
        .expect(200);

      expect(mockExportService.exportToCSV).toHaveBeenCalledWith('user-123', {
        dateRange: {
          startDate: new Date('2024-01-01T00:00:00.000Z'),
          endDate: new Date('2024-01-31T23:59:59.999Z')
        },
        projectIds: ['proj-1'],
        tags: ['tag1']
      });
    });

    it('should require format parameter', async () => {
      const response = await request(app)
        .get('/api/reports/export')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate format parameter', async () => {
      const response = await request(app)
        .get('/api/reports/export')
        .query({ format: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle export service errors', async () => {
      mockExportService.exportToCSV.mockRejectedValue(new Error('Export failed'));

      const response = await request(app)
        .get('/api/reports/export')
        .query({ format: 'csv' })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to export data'
        }
      });
    });
  });
});