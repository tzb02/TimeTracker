import { ReportService, ReportFilters } from './reportService';
import { createObjectCsvWriter } from 'csv-writer';
import * as puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export class ExportService {
  private reportService = new ReportService();

  /**
   * Export time entries to CSV format
   */
  async exportToCSV(userId: string, filters: ReportFilters = {}): Promise<string> {
    try {
      // Get the CSV data from report service
      const csvData = await this.reportService.exportTimeEntries(userId, filters);
      return csvData;
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw new Error('Failed to export data to CSV');
    }
  }

  /**
   * Export time report to PDF format
   */
  async exportToPDF(userId: string, filters: ReportFilters = {}): Promise<Buffer> {
    let browser: puppeteer.Browser | null = null;
    let tempHtmlPath: string | null = null;

    try {
      // Generate report data
      const reportData = await this.reportService.generateTimeReport(userId, filters);
      
      // Create HTML content for PDF
      const htmlContent = this.generateReportHTML(reportData, filters);
      
      // Write HTML to temporary file
      tempHtmlPath = path.join(os.tmpdir(), `time-report-${Date.now()}.html`);
      await fs.writeFile(tempHtmlPath, htmlContent);

      // Launch Puppeteer
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      
      // Load the HTML file
      await page.goto(`file://${tempHtmlPath}`, { 
        waitUntil: 'networkidle0' 
      });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      throw new Error('Failed to export data to PDF');
    } finally {
      // Cleanup
      if (browser) {
        await browser.close();
      }
      if (tempHtmlPath) {
        try {
          await fs.unlink(tempHtmlPath);
        } catch (unlinkError) {
          console.warn('Failed to cleanup temp HTML file:', unlinkError);
        }
      }
    }
  }

  /**
   * Generate HTML content for PDF report
   */
  private generateReportHTML(reportData: any, filters: ReportFilters): string {
    const formatDuration = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    };

    const formatDate = (dateStr: string): string => {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const formatPercentage = (percentage: number): string => {
      return `${percentage}%`;
    };

    // Generate date range string
    let dateRangeStr = 'All Time';
    if (filters.dateRange) {
      const startDate = filters.dateRange.startDate.toLocaleDateString();
      const endDate = filters.dateRange.endDate.toLocaleDateString();
      dateRangeStr = `${startDate} - ${endDate}`;
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Time Tracking Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 20px;
        }
        
        .header h1 {
            color: #1f2937;
            margin: 0 0 10px 0;
            font-size: 2.5em;
        }
        
        .header .date-range {
            color: #6b7280;
            font-size: 1.1em;
        }
        
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .summary-card {
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            text-align: center;
        }
        
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #374151;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .summary-card .value {
            font-size: 2em;
            font-weight: bold;
            color: #1f2937;
            margin: 0;
        }
        
        .section {
            margin-bottom: 40px;
        }
        
        .section h2 {
            color: #1f2937;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        
        .project-breakdown {
            display: grid;
            gap: 15px;
        }
        
        .project-item {
            display: flex;
            align-items: center;
            padding: 15px;
            background: #f9fafb;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
        }
        
        .project-color {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            margin-right: 15px;
            flex-shrink: 0;
        }
        
        .project-info {
            flex-grow: 1;
        }
        
        .project-name {
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 5px;
        }
        
        .project-stats {
            color: #6b7280;
            font-size: 0.9em;
        }
        
        .project-duration {
            font-weight: 600;
            color: #1f2937;
            text-align: right;
        }
        
        .daily-breakdown {
            display: grid;
            gap: 15px;
        }
        
        .daily-item {
            padding: 15px;
            background: #f9fafb;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
        }
        
        .daily-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .daily-date {
            font-weight: 600;
            color: #1f2937;
        }
        
        .daily-total {
            font-weight: 600;
            color: #059669;
        }
        
        .daily-projects {
            display: grid;
            gap: 8px;
            margin-top: 10px;
        }
        
        .daily-project {
            display: flex;
            align-items: center;
            padding: 8px;
            background: white;
            border-radius: 4px;
            font-size: 0.9em;
        }
        
        .daily-project-color {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 10px;
        }
        
        .daily-project-name {
            flex-grow: 1;
            color: #374151;
        }
        
        .daily-project-duration {
            color: #6b7280;
            font-weight: 500;
        }
        
        .footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 0.9em;
        }
        
        @media print {
            body {
                padding: 0;
            }
            
            .section {
                break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Time Tracking Report</h1>
        <div class="date-range">${dateRangeStr}</div>
    </div>
    
    <div class="summary">
        <div class="summary-card">
            <h3>Total Time</h3>
            <div class="value">${formatDuration(reportData.totalDuration)}</div>
        </div>
        <div class="summary-card">
            <h3>Total Entries</h3>
            <div class="value">${reportData.totalEntries}</div>
        </div>
        <div class="summary-card">
            <h3>Average Session</h3>
            <div class="value">${formatDuration(reportData.averageDuration)}</div>
        </div>
        <div class="summary-card">
            <h3>Longest Session</h3>
            <div class="value">${formatDuration(reportData.longestEntry)}</div>
        </div>
    </div>
    
    ${reportData.projectBreakdown.length > 0 ? `
    <div class="section">
        <h2>Time by Project</h2>
        <div class="project-breakdown">
            ${reportData.projectBreakdown.map((project: any) => `
                <div class="project-item">
                    <div class="project-color" style="background-color: ${project.projectColor}"></div>
                    <div class="project-info">
                        <div class="project-name">${project.projectName}</div>
                        <div class="project-stats">${project.entryCount} entries • ${formatPercentage(project.percentage)} of total time</div>
                    </div>
                    <div class="project-duration">${formatDuration(project.totalDuration)}</div>
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}
    
    ${reportData.dailyBreakdown.length > 0 ? `
    <div class="section">
        <h2>Daily Breakdown</h2>
        <div class="daily-breakdown">
            ${reportData.dailyBreakdown.slice(0, 14).map((day: any) => `
                <div class="daily-item">
                    <div class="daily-header">
                        <div class="daily-date">${formatDate(day.date)}</div>
                        <div class="daily-total">${formatDuration(day.totalDuration)}</div>
                    </div>
                    ${day.projects.length > 0 ? `
                        <div class="daily-projects">
                            ${day.projects.map((project: any) => `
                                <div class="daily-project">
                                    <div class="daily-project-color" style="background-color: ${project.projectColor}"></div>
                                    <div class="daily-project-name">${project.projectName}</div>
                                    <div class="daily-project-duration">${formatDuration(project.duration)}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}
    
    ${reportData.tagBreakdown.length > 0 ? `
    <div class="section">
        <h2>Time by Tags</h2>
        <div class="project-breakdown">
            ${reportData.tagBreakdown.slice(0, 10).map((tag: any) => `
                <div class="project-item">
                    <div class="project-color" style="background-color: #6b7280"></div>
                    <div class="project-info">
                        <div class="project-name">#${tag.tag}</div>
                        <div class="project-stats">${tag.entryCount} entries • ${formatPercentage(tag.percentage)} of total time</div>
                    </div>
                    <div class="project-duration">${formatDuration(tag.totalDuration)}</div>
                </div>
            `).join('')}
        </div>
    </div>
    ` : ''}
    
    <div class="footer">
        Generated on ${new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
    </div>
</body>
</html>`;
  }
}