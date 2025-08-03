import { ExportService } from '../exportService';
import { ReportService } from '../reportService';

// Mock the ReportService
jest.mock('../reportService');
const MockedReportService = ReportService as jest.MockedClass<typeof ReportService>;

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn()
}));

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
    unlink: jest.fn()
  }
}));

import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';

describe('ExportService', () => {
  let exportService: ExportService;
  let mockReportService: jest.Mocked<ReportService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock report service instance
    mockReportService = new MockedReportService() as jest.Mocked<ReportService>;
    
    // Mock the constructor to return our mock
    MockedReportService.mockImplementation(() => mockReportService);
    
    exportService = new ExportService();
  });

  describe('exportToCSV', () => {
    it('should export time entries to CSV format', async () => {
      const userId = 'user-123';
      const filters = {
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31')
        }
      };
      const expectedCsvData = 'Date,Project,Description,Start Time,End Time,Duration (hours),Tags\n2024-01-15,"Project A","Task 1",2024-01-15T09:00:00.000Z,2024-01-15T10:30:00.000Z,1.50,"tag1, tag2"';

      mockReportService.exportTimeEntries.mockResolvedValue(expectedCsvData);

      const result = await exportService.exportToCSV(userId, filters);

      expect(result).toBe(expectedCsvData);
      expect(mockReportService.exportTimeEntries).toHaveBeenCalledWith(userId, filters);
    });

    it('should handle CSV export errors', async () => {
      const userId = 'user-123';
      const error = new Error('Database connection failed');

      mockReportService.exportTimeEntries.mockRejectedValue(error);

      await expect(exportService.exportToCSV(userId)).rejects.toThrow('Failed to export data to CSV');
      expect(mockReportService.exportTimeEntries).toHaveBeenCalledWith(userId, {});
    });
  });

  describe('exportToPDF', () => {
    let mockBrowser: any;
    let mockPage: any;

    beforeEach(() => {
      mockPage = {
        goto: jest.fn(),
        pdf: jest.fn()
      };

      mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn()
      };

      (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);
    });

    it('should export time report to PDF format', async () => {
      const userId = 'user-123';
      const filters = {
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31')
        }
      };

      const mockReportData = {
        totalDuration: 7200, // 2 hours
        totalEntries: 3,
        averageDuration: 2400, // 40 minutes
        longestEntry: 3600, // 1 hour
        shortestEntry: 1800, // 30 minutes
        projectBreakdown: [
          {
            projectId: 'proj-1',
            projectName: 'Project A',
            projectColor: '#3b82f6',
            totalDuration: 5400, // 1.5 hours
            entryCount: 2,
            percentage: 75
          }
        ],
        dailyBreakdown: [
          {
            date: '2024-01-15',
            totalDuration: 7200,
            entryCount: 3,
            projects: [
              {
                projectId: 'proj-1',
                projectName: 'Project A',
                projectColor: '#3b82f6',
                duration: 5400
              }
            ]
          }
        ],
        tagBreakdown: [
          {
            tag: 'development',
            totalDuration: 5400,
            entryCount: 2,
            percentage: 75
          }
        ]
      };

      const mockPdfBuffer = Buffer.from('mock-pdf-content');

      mockReportService.generateTimeReport.mockResolvedValue(mockReportData);
      mockPage.pdf.mockResolvedValue(mockPdfBuffer);

      const result = await exportService.exportToPDF(userId, filters);

      expect(result).toEqual(mockPdfBuffer);
      expect(mockReportService.generateTimeReport).toHaveBeenCalledWith(userId, filters);
      expect(puppeteer.launch).toHaveBeenCalledWith({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalled();
      expect(mockPage.pdf).toHaveBeenCalledWith({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should cleanup resources on success', async () => {
      const userId = 'user-123';
      const mockReportData = {
        totalDuration: 3600,
        totalEntries: 1,
        averageDuration: 3600,
        longestEntry: 3600,
        shortestEntry: 3600,
        projectBreakdown: [],
        dailyBreakdown: [],
        tagBreakdown: []
      };

      mockReportService.generateTimeReport.mockResolvedValue(mockReportData);
      mockPage.pdf.mockResolvedValue(Buffer.from('pdf'));

      await exportService.exportToPDF(userId);

      expect(mockBrowser.close).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should cleanup resources on error', async () => {
      const userId = 'user-123';
      const error = new Error('PDF generation failed');

      mockReportService.generateTimeReport.mockRejectedValue(error);

      await expect(exportService.exportToPDF(userId)).rejects.toThrow('Failed to export data to PDF');

      // Browser should not be called if report generation fails before browser launch
      expect(mockBrowser.close).not.toHaveBeenCalled();
    });

    it('should handle puppeteer launch failure', async () => {
      const userId = 'user-123';
      const mockReportData = {
        totalDuration: 3600,
        totalEntries: 1,
        averageDuration: 3600,
        longestEntry: 3600,
        shortestEntry: 3600,
        projectBreakdown: [],
        dailyBreakdown: [],
        tagBreakdown: []
      };

      mockReportService.generateTimeReport.mockResolvedValue(mockReportData);
      (puppeteer.launch as jest.Mock).mockRejectedValue(new Error('Puppeteer launch failed'));

      await expect(exportService.exportToPDF(userId)).rejects.toThrow('Failed to export data to PDF');
    });

    it('should handle file cleanup errors gracefully', async () => {
      const userId = 'user-123';
      const mockReportData = {
        totalDuration: 3600,
        totalEntries: 1,
        averageDuration: 3600,
        longestEntry: 3600,
        shortestEntry: 3600,
        projectBreakdown: [],
        dailyBreakdown: [],
        tagBreakdown: []
      };

      mockReportService.generateTimeReport.mockResolvedValue(mockReportData);
      mockPage.pdf.mockResolvedValue(Buffer.from('pdf'));
      (fs.unlink as jest.Mock).mockRejectedValue(new Error('File cleanup failed'));

      // Should not throw even if cleanup fails
      const result = await exportService.exportToPDF(userId);
      expect(result).toEqual(Buffer.from('pdf'));
    });
    it('should generate valid HTML for PDF report', async () => {
      const userId = 'user-123';
      const mockReportData = {
        totalDuration: 7200,
        totalEntries: 3,
        averageDuration: 2400,
        longestEntry: 3600,
        shortestEntry: 1800,
        projectBreakdown: [
          {
            projectId: 'proj-1',
            projectName: 'Project A',
            projectColor: '#3b82f6',
            totalDuration: 5400,
            entryCount: 2,
            percentage: 75
          }
        ],
        dailyBreakdown: [
          {
            date: '2024-01-15',
            totalDuration: 7200,
            entryCount: 3,
            projects: [
              {
                projectId: 'proj-1',
                projectName: 'Project A',
                projectColor: '#3b82f6',
                duration: 5400
              }
            ]
          }
        ],
        tagBreakdown: [
          {
            tag: 'development',
            totalDuration: 5400,
            entryCount: 2,
            percentage: 75
          }
        ]
      };

      const filters = {
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31')
        }
      };

      mockReportService.generateTimeReport.mockResolvedValue(mockReportData);
      mockPage.pdf.mockResolvedValue(Buffer.from('pdf'));

      await exportService.exportToPDF(userId, filters);

      // Verify HTML was written to file
      expect(fs.writeFile).toHaveBeenCalled();
      const writeFileCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const htmlContent = writeFileCall[1];

      // Check that HTML contains expected content
      expect(htmlContent).toContain('Time Tracking Report');
      expect(htmlContent).toContain('2h 0m'); // Total time formatted
      expect(htmlContent).toContain('Project A');
      expect(htmlContent).toContain('#development');
      expect(htmlContent).toContain('12/31/2023 - 1/30/2024'); // Date format matches what's actually generated
    });

    it('should handle empty report data', async () => {
      const userId = 'user-123';
      const mockReportData = {
        totalDuration: 0,
        totalEntries: 0,
        averageDuration: 0,
        longestEntry: 0,
        shortestEntry: 0,
        projectBreakdown: [],
        dailyBreakdown: [],
        tagBreakdown: []
      };

      mockReportService.generateTimeReport.mockResolvedValue(mockReportData);
      mockPage.pdf.mockResolvedValue(Buffer.from('pdf'));

      await exportService.exportToPDF(userId);

      expect(fs.writeFile).toHaveBeenCalled();
      const writeFileCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const htmlContent = writeFileCall[1];

      expect(htmlContent).toContain('0h 0m');
      expect(htmlContent).toContain('All Time');
    });
  });
});