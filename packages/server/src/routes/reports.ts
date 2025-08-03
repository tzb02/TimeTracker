import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { ReportService } from '../services/reportService';
import { ExportService } from '../services/exportService';
import { CacheService } from '../services/cacheService';

const router = Router();
const reportService = new ReportService();
const exportService = new ExportService();
const cacheService = new CacheService();

// Validation middleware
const validateDateRange = [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
  query('projectIds').optional().isArray().withMessage('Project IDs must be an array'),
  query('tags').optional().isArray().withMessage('Tags must be an array'),
  query('groupBy').optional().isIn(['day', 'week', 'month', 'project', 'tag']).withMessage('Invalid groupBy value')
];

const validateExportFormat = [
  query('format').isIn(['csv', 'pdf']).withMessage('Format must be csv or pdf')
];

/**
 * GET /api/reports/time
 * Generate comprehensive time report with filtering
 */
router.get('/time', authenticateToken, validateDateRange, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: errors.array()
        }
      });
    }

    const userId = req.user!.userId;
    const { startDate, endDate, projectIds, tags, groupBy } = req.query;

    // Build filters
    const filters: any = {};
    if (startDate && endDate) {
      filters.dateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };
    }
    if (projectIds) {
      filters.projectIds = Array.isArray(projectIds) ? projectIds : [projectIds];
    }
    if (tags) {
      filters.tags = Array.isArray(tags) ? tags : [tags];
    }
    if (groupBy) {
      filters.groupBy = groupBy;
    }

    // Generate cache key
    const cacheKey = `time_report:${userId}:${JSON.stringify(filters)}`;
    
    // Try to get from cache first
    const cachedReport = await cacheService.get(cacheKey);
    if (cachedReport) {
      return res.json({
        success: true,
        data: cachedReport,
        cached: true
      });
    }

    // Generate report
    const report = await reportService.generateTimeReport(userId, filters);

    // Cache the result for 5 minutes
    await cacheService.set(cacheKey, report, 300);

    res.json({
      success: true,
      data: report,
      cached: false
    });
  } catch (error) {
    console.error('Error generating time report:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate time report'
      }
    });
  }
});

/**
 * GET /api/reports/weekly
 * Generate weekly report for a specific week
 */
router.get('/weekly', authenticateToken, [
  query('weekStart').isISO8601().withMessage('Week start must be a valid ISO 8601 date')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: errors.array()
        }
      });
    }

    const userId = req.user!.userId;
    const weekStart = new Date(req.query.weekStart as string);

    // Generate cache key
    const cacheKey = `weekly_report:${userId}:${weekStart.toISOString()}`;
    
    // Try to get from cache first
    const cachedReport = await cacheService.get(cacheKey);
    if (cachedReport) {
      return res.json({
        success: true,
        data: cachedReport,
        cached: true
      });
    }

    // Generate report
    const report = await reportService.generateWeeklyReport(userId, weekStart);

    // Cache the result for 1 hour
    await cacheService.set(cacheKey, report, 3600);

    res.json({
      success: true,
      data: report,
      cached: false
    });
  } catch (error) {
    console.error('Error generating weekly report:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate weekly report'
      }
    });
  }
});

/**
 * GET /api/reports/monthly
 * Generate monthly report for a specific month
 */
router.get('/monthly', authenticateToken, [
  query('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  query('year').isInt({ min: 2020, max: 2030 }).withMessage('Year must be between 2020 and 2030')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: errors.array()
        }
      });
    }

    const userId = req.user!.userId;
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);

    // Generate cache key
    const cacheKey = `monthly_report:${userId}:${year}-${month}`;
    
    // Try to get from cache first
    const cachedReport = await cacheService.get(cacheKey);
    if (cachedReport) {
      return res.json({
        success: true,
        data: cachedReport,
        cached: true
      });
    }

    // Generate report
    const report = await reportService.generateMonthlyReport(userId, month, year);

    // Cache the result for 2 hours
    await cacheService.set(cacheKey, report, 7200);

    res.json({
      success: true,
      data: report,
      cached: false
    });
  } catch (error) {
    console.error('Error generating monthly report:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate monthly report'
      }
    });
  }
});

/**
 * GET /api/reports/dashboard
 * Get dashboard summary data
 */
router.get('/dashboard', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Generate cache key
    const cacheKey = `dashboard_summary:${userId}`;
    
    // Try to get from cache first
    const cachedSummary = await cacheService.get(cacheKey);
    if (cachedSummary) {
      return res.json({
        success: true,
        data: cachedSummary,
        cached: true
      });
    }

    // Generate summary
    const summary = await reportService.getDashboardSummary(userId);

    // Cache the result for 10 minutes
    await cacheService.set(cacheKey, summary, 600);

    res.json({
      success: true,
      data: summary,
      cached: false
    });
  } catch (error) {
    console.error('Error generating dashboard summary:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate dashboard summary'
      }
    });
  }
});

/**
 * GET /api/reports/export
 * Export time entries in CSV or PDF format
 */
router.get('/export', authenticateToken, [...validateDateRange, ...validateExportFormat], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: errors.array()
        }
      });
    }

    const userId = req.user!.userId;
    const { startDate, endDate, projectIds, tags, format } = req.query;

    // Build filters
    const filters: any = {};
    if (startDate && endDate) {
      filters.dateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };
    }
    if (projectIds) {
      filters.projectIds = Array.isArray(projectIds) ? projectIds : [projectIds];
    }
    if (tags) {
      filters.tags = Array.isArray(tags) ? tags : [tags];
    }

    if (format === 'csv') {
      const csvData = await exportService.exportToCSV(userId, filters);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="time-entries.csv"');
      res.send(csvData);
    } else if (format === 'pdf') {
      const pdfBuffer = await exportService.exportToPDF(userId, filters);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="time-report.pdf"');
      res.send(pdfBuffer);
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to export data'
      }
    });
  }
});

export default router;