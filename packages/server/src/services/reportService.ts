import { getDatabase } from '../database';

export interface DateRange {
    startDate: Date;
    endDate: Date;
}

export interface ReportFilters {
    projectIds?: string[];
    tags?: string[];
    dateRange?: DateRange;
    groupBy?: 'day' | 'week' | 'month' | 'project' | 'tag';
}

export interface TimeReportData {
    totalDuration: number;
    totalEntries: number;
    averageDuration: number;
    longestEntry: number;
    shortestEntry: number;
    projectBreakdown: ProjectTimeBreakdown[];
    dailyBreakdown: DailyTimeBreakdown[];
    tagBreakdown: TagTimeBreakdown[];
}

export interface ProjectTimeBreakdown {
    projectId: string;
    projectName: string;
    projectColor: string;
    totalDuration: number;
    entryCount: number;
    percentage: number;
}

export interface DailyTimeBreakdown {
    date: string; // YYYY-MM-DD format
    totalDuration: number;
    entryCount: number;
    projects: Array<{
        projectId: string;
        projectName: string;
        projectColor: string;
        duration: number;
    }>;
}

export interface TagTimeBreakdown {
    tag: string;
    totalDuration: number;
    entryCount: number;
    percentage: number;
}

export interface ProductivityMetrics {
    averageSessionLength: number;
    totalSessions: number;
    mostProductiveHour: number;
    mostProductiveDay: string;
    focusScore: number; // 0-100 based on session consistency
    streakDays: number;
}

export interface WeeklyReport {
    weekStart: Date;
    weekEnd: Date;
    totalDuration: number;
    dailyBreakdown: Array<{
        date: string;
        duration: number;
        entryCount: number;
    }>;
    topProjects: Array<{
        projectId: string;
        projectName: string;
        duration: number;
        percentage: number;
    }>;
    productivity: ProductivityMetrics;
}

export interface MonthlyReport {
    month: number;
    year: number;
    totalDuration: number;
    weeklyBreakdown: Array<{
        weekStart: Date;
        weekEnd: Date;
        duration: number;
    }>;
    projectBreakdown: ProjectTimeBreakdown[];
    productivity: ProductivityMetrics;
    comparison: {
        previousMonth: {
            totalDuration: number;
            percentageChange: number;
        };
    };
}

export class ReportService {
    private db = getDatabase();

    /**
     * Generate comprehensive time report for a user
     */
    async generateTimeReport(userId: string, filters: ReportFilters = {}): Promise<TimeReportData> {
        const { projectIds, tags, dateRange } = filters;

        let query = `
      SELECT 
        te.*,
        p.name as project_name,
        p.color as project_color
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      WHERE te.user_id = $1 AND te.is_running = false
    `;

        const params: any[] = [userId];
        let paramIndex = 2;

        // Apply filters
        if (projectIds && projectIds.length > 0) {
            query += ` AND te.project_id = ANY($${paramIndex++})`;
            params.push(projectIds);
        }

        if (tags && tags.length > 0) {
            query += ` AND te.tags && $${paramIndex++}`;
            params.push(tags);
        }

        if (dateRange) {
            query += ` AND te.start_time >= $${paramIndex++} AND te.start_time <= $${paramIndex++}`;
            params.push(dateRange.startDate, dateRange.endDate);
        }

        query += ` ORDER BY te.start_time DESC`;

        const result = await this.db.query(query, params);
        const entries = result.rows;

        if (entries.length === 0) {
            return this.getEmptyReport();
        }

        // Calculate basic statistics
        const totalDuration = entries.reduce((sum: number, entry: any) => sum + entry.duration, 0);
        const totalEntries = entries.length;
        const averageDuration = Math.round(totalDuration / totalEntries);
        const durations = entries.map((entry: any) => entry.duration);
        const longestEntry = Math.max(...durations);
        const shortestEntry = Math.min(...durations);

        // Generate breakdowns
        const projectBreakdown = this.generateProjectBreakdown(entries, totalDuration);
        const dailyBreakdown = this.generateDailyBreakdown(entries);
        const tagBreakdown = this.generateTagBreakdown(entries, totalDuration);

        return {
            totalDuration,
            totalEntries,
            averageDuration,
            longestEntry,
            shortestEntry,
            projectBreakdown,
            dailyBreakdown,
            tagBreakdown
        };
    }

    /**
     * Generate weekly report for a user
     */
    async generateWeeklyReport(userId: string, weekStart: Date): Promise<WeeklyReport> {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const query = `
      SELECT 
        te.*,
        p.name as project_name,
        p.color as project_color
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      WHERE te.user_id = $1 
        AND te.start_time >= $2 
        AND te.start_time <= $3
        AND te.is_running = false
      ORDER BY te.start_time ASC
    `;

        const result = await this.db.query(query, [userId, weekStart, weekEnd]);
        const entries = result.rows;

        const totalDuration = entries.reduce((sum: number, entry: any) => sum + entry.duration, 0);

        // Generate daily breakdown
        const dailyBreakdown = this.generateWeeklyDailyBreakdown(entries, weekStart);

        // Generate top projects
        const projectMap = new Map<string, { name: string; duration: number }>();
        entries.forEach((entry: any) => {
            const existing = projectMap.get(entry.project_id) || { name: entry.project_name, duration: 0 };
            existing.duration += entry.duration;
            projectMap.set(entry.project_id, existing);
        });

        const topProjects = Array.from(projectMap.entries())
            .map(([projectId, data]) => ({
                projectId,
                projectName: data.name,
                duration: data.duration,
                percentage: totalDuration > 0 ? Math.round((data.duration / totalDuration) * 100) : 0
            }))
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 5);

        // Calculate productivity metrics
        const productivity = await this.calculateProductivityMetrics(userId, { startDate: weekStart, endDate: weekEnd });

        return {
            weekStart,
            weekEnd,
            totalDuration,
            dailyBreakdown,
            topProjects,
            productivity
        };
    }

    /**
     * Generate monthly report for a user
     */
    async generateMonthlyReport(userId: string, month: number, year: number): Promise<MonthlyReport> {
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

        const query = `
      SELECT 
        te.*,
        p.name as project_name,
        p.color as project_color
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      WHERE te.user_id = $1 
        AND te.start_time >= $2 
        AND te.start_time <= $3
        AND te.is_running = false
      ORDER BY te.start_time ASC
    `;

        const result = await this.db.query(query, [userId, monthStart, monthEnd]);
        const entries = result.rows;

        const totalDuration = entries.reduce((sum: number, entry: any) => sum + entry.duration, 0);

        // Generate weekly breakdown
        const weeklyBreakdown = this.generateMonthlyWeeklyBreakdown(entries, monthStart, monthEnd);

        // Generate project breakdown
        const projectBreakdown = this.generateProjectBreakdown(entries, totalDuration);

        // Calculate productivity metrics
        const productivity = await this.calculateProductivityMetrics(userId, { startDate: monthStart, endDate: monthEnd });

        // Get previous month comparison
        const previousMonthStart = new Date(year, month - 2, 1);
        const previousMonthEnd = new Date(year, month - 1, 0, 23, 59, 59, 999);
        const previousMonthData = await this.generateTimeReport(userId, {
            dateRange: { startDate: previousMonthStart, endDate: previousMonthEnd }
        });

        const percentageChange = previousMonthData.totalDuration > 0
            ? Math.round(((totalDuration - previousMonthData.totalDuration) / previousMonthData.totalDuration) * 100)
            : 0;

        return {
            month,
            year,
            totalDuration,
            weeklyBreakdown,
            projectBreakdown,
            productivity,
            comparison: {
                previousMonth: {
                    totalDuration: previousMonthData.totalDuration,
                    percentageChange
                }
            }
        };
    }

    /**
     * Calculate productivity metrics for a date range
     */
    async calculateProductivityMetrics(userId: string, dateRange: DateRange): Promise<ProductivityMetrics> {
        const query = `
      SELECT 
        te.*,
        EXTRACT(HOUR FROM te.start_time) as start_hour,
        EXTRACT(DOW FROM te.start_time) as day_of_week,
        DATE(te.start_time) as entry_date
      FROM time_entries te
      WHERE te.user_id = $1 
        AND te.start_time >= $2 
        AND te.start_time <= $3
        AND te.is_running = false
      ORDER BY te.start_time ASC
    `;

        const result = await this.db.query(query, [userId, dateRange.startDate, dateRange.endDate]);
        const entries = result.rows;

        if (entries.length === 0) {
            return {
                averageSessionLength: 0,
                totalSessions: 0,
                mostProductiveHour: 9,
                mostProductiveDay: 'Monday',
                focusScore: 0,
                streakDays: 0
            };
        }

        // Calculate average session length
        const totalDuration = entries.reduce((sum: number, entry: any) => sum + entry.duration, 0);
        const averageSessionLength = Math.round(totalDuration / entries.length);

        // Find most productive hour
        const hourMap = new Map<number, number>();
        entries.forEach((entry: any) => {
            const hour = parseInt(entry.start_hour);
            hourMap.set(hour, (hourMap.get(hour) || 0) + entry.duration);
        });
        const mostProductiveHour = Array.from(hourMap.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 9;

        // Find most productive day
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayMap = new Map<number, number>();
        entries.forEach((entry: any) => {
            const day = parseInt(entry.day_of_week);
            dayMap.set(day, (dayMap.get(day) || 0) + entry.duration);
        });
        const mostProductiveDayIndex = Array.from(dayMap.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 1;
        const mostProductiveDay = dayNames[mostProductiveDayIndex];

        // Calculate focus score (consistency of daily work)
        const dailyTotals = new Map<string, number>();
        entries.forEach((entry: any) => {
            const date = entry.entry_date.toISOString().split('T')[0];
            dailyTotals.set(date, (dailyTotals.get(date) || 0) + entry.duration);
        });

        const dailyValues = Array.from(dailyTotals.values());
        const avgDaily = dailyValues.reduce((sum, val) => sum + val, 0) / dailyValues.length;
        const variance = dailyValues.reduce((sum, val) => sum + Math.pow(val - avgDaily, 2), 0) / dailyValues.length;
        const stdDev = Math.sqrt(variance);
        const focusScore = Math.max(0, Math.min(100, Math.round(100 - (stdDev / avgDaily) * 50)));

        // Calculate streak days
        const streakDays = this.calculateStreakDays(Array.from(dailyTotals.keys()).sort());

        return {
            averageSessionLength,
            totalSessions: entries.length,
            mostProductiveHour,
            mostProductiveDay,
            focusScore,
            streakDays
        };
    }

    /**
     * Export time entries as CSV
     */
    async exportTimeEntries(userId: string, filters: ReportFilters = {}): Promise<string> {

        // Get detailed entries for CSV export
        let query = `
      SELECT 
        te.*,
        p.name as project_name,
        p.color as project_color
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      WHERE te.user_id = $1 AND te.is_running = false
    `;

        const params: any[] = [userId];
        let paramIndex = 2;

        // Apply same filters as report
        if (filters.projectIds && filters.projectIds.length > 0) {
            query += ` AND te.project_id = ANY($${paramIndex++})`;
            params.push(filters.projectIds);
        }

        if (filters.tags && filters.tags.length > 0) {
            query += ` AND te.tags && $${paramIndex++}`;
            params.push(filters.tags);
        }

        if (filters.dateRange) {
            query += ` AND te.start_time >= $${paramIndex++} AND te.start_time <= $${paramIndex++}`;
            params.push(filters.dateRange.startDate, filters.dateRange.endDate);
        }

        query += ` ORDER BY te.start_time DESC`;

        const result = await this.db.query(query, params);
        const entries = result.rows;

        // Generate CSV
        const headers = ['Date', 'Project', 'Description', 'Start Time', 'End Time', 'Duration (hours)', 'Tags'];
        const csvRows = [headers.join(',')];

        entries.forEach((entry: any) => {
            const row = [
                entry.start_time.toISOString().split('T')[0],
                `"${entry.project_name}"`,
                `"${entry.description || ''}"`,
                entry.start_time.toISOString(),
                entry.end_time ? entry.end_time.toISOString() : '',
                (entry.duration / 3600).toFixed(2),
                `"${entry.tags.join(', ')}"`
            ];
            csvRows.push(row.join(','));
        });

        return csvRows.join('\n');
    }

    /**
     * Get time tracking summary for dashboard
     */
    async getDashboardSummary(userId: string): Promise<{
        today: { duration: number; entries: number };
        thisWeek: { duration: number; entries: number };
        thisMonth: { duration: number; entries: number };
        topProjects: Array<{ name: string; duration: number; color: string }>;
    }> {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(todayStart.getDate() - todayStart.getDay());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const queries = [
            // Today
            this.db.query(`
        SELECT COALESCE(SUM(duration), 0) as duration, COUNT(*) as entries
        FROM time_entries 
        WHERE user_id = $1 AND start_time >= $2 AND is_running = false
      `, [userId, todayStart]),

            // This week
            this.db.query(`
        SELECT COALESCE(SUM(duration), 0) as duration, COUNT(*) as entries
        FROM time_entries 
        WHERE user_id = $1 AND start_time >= $2 AND is_running = false
      `, [userId, weekStart]),

            // This month
            this.db.query(`
        SELECT COALESCE(SUM(duration), 0) as duration, COUNT(*) as entries
        FROM time_entries 
        WHERE user_id = $1 AND start_time >= $2 AND is_running = false
      `, [userId, monthStart]),

            // Top projects this month
            this.db.query(`
        SELECT 
          p.name,
          p.color,
          COALESCE(SUM(te.duration), 0) as duration
        FROM projects p
        LEFT JOIN time_entries te ON p.id = te.project_id AND te.start_time >= $2 AND te.is_running = false
        WHERE p.user_id = $1 AND p.is_active = true
        GROUP BY p.id, p.name, p.color
        ORDER BY duration DESC
        LIMIT 5
      `, [userId, monthStart])
        ];

        const [todayResult, weekResult, monthResult, projectsResult] = await Promise.all(queries);

        return {
            today: {
                duration: parseInt(todayResult.rows[0].duration),
                entries: parseInt(todayResult.rows[0].entries)
            },
            thisWeek: {
                duration: parseInt(weekResult.rows[0].duration),
                entries: parseInt(weekResult.rows[0].entries)
            },
            thisMonth: {
                duration: parseInt(monthResult.rows[0].duration),
                entries: parseInt(monthResult.rows[0].entries)
            },
            topProjects: projectsResult.rows.map((row: any) => ({
                name: row.name,
                duration: parseInt(row.duration),
                color: row.color
            }))
        };
    }

    // Private helper methods

    private getEmptyReport(): TimeReportData {
        return {
            totalDuration: 0,
            totalEntries: 0,
            averageDuration: 0,
            longestEntry: 0,
            shortestEntry: 0,
            projectBreakdown: [],
            dailyBreakdown: [],
            tagBreakdown: []
        };
    }

    private generateProjectBreakdown(entries: any[], totalDuration: number): ProjectTimeBreakdown[] {
        const projectMap = new Map<string, { name: string; color: string; duration: number; count: number }>();

        entries.forEach((entry: any) => {
            const existing = projectMap.get(entry.project_id) || {
                name: entry.project_name,
                color: entry.project_color,
                duration: 0,
                count: 0
            };
            existing.duration += entry.duration;
            existing.count += 1;
            projectMap.set(entry.project_id, existing);
        });

        return Array.from(projectMap.entries())
            .map(([projectId, data]) => ({
                projectId,
                projectName: data.name,
                projectColor: data.color,
                totalDuration: data.duration,
                entryCount: data.count,
                percentage: totalDuration > 0 ? Math.round((data.duration / totalDuration) * 100) : 0
            }))
            .sort((a, b) => b.totalDuration - a.totalDuration);
    }

    private generateDailyBreakdown(entries: any[]): DailyTimeBreakdown[] {
        const dailyMap = new Map<string, { duration: number; count: number; projects: Map<string, any> }>();

        entries.forEach((entry: any) => {
            const date = entry.start_time.toISOString().split('T')[0];
            const existing = dailyMap.get(date) || { duration: 0, count: 0, projects: new Map() };

            existing.duration += entry.duration;
            existing.count += 1;

            const projectData = existing.projects.get(entry.project_id) || {
                projectId: entry.project_id,
                projectName: entry.project_name,
                projectColor: entry.project_color,
                duration: 0
            };
            projectData.duration += entry.duration;
            existing.projects.set(entry.project_id, projectData);

            dailyMap.set(date, existing);
        });

        return Array.from(dailyMap.entries())
            .map(([date, data]) => ({
                date,
                totalDuration: data.duration,
                entryCount: data.count,
                projects: Array.from(data.projects.values()).sort((a, b) => b.duration - a.duration)
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    private generateTagBreakdown(entries: any[], totalDuration: number): TagTimeBreakdown[] {
        const tagMap = new Map<string, { duration: number; count: number }>();

        entries.forEach((entry: any) => {
            entry.tags.forEach((tag: string) => {
                const existing = tagMap.get(tag) || { duration: 0, count: 0 };
                existing.duration += entry.duration;
                existing.count += 1;
                tagMap.set(tag, existing);
            });
        });

        return Array.from(tagMap.entries())
            .map(([tag, data]) => ({
                tag,
                totalDuration: data.duration,
                entryCount: data.count,
                percentage: totalDuration > 0 ? Math.round((data.duration / totalDuration) * 100) : 0
            }))
            .sort((a, b) => b.totalDuration - a.totalDuration);
    }

    private generateWeeklyDailyBreakdown(entries: any[], weekStart: Date): Array<{ date: string; duration: number; entryCount: number }> {
        const dailyMap = new Map<string, { duration: number; count: number }>();

        // Initialize all days of the week
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            dailyMap.set(dateStr, { duration: 0, count: 0 });
        }

        entries.forEach((entry: any) => {
            const date = entry.start_time.toISOString().split('T')[0];
            const existing = dailyMap.get(date);
            if (existing) {
                existing.duration += entry.duration;
                existing.count += 1;
            }
        });

        return Array.from(dailyMap.entries())
            .map(([date, data]) => ({
                date,
                duration: data.duration,
                entryCount: data.count
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    private generateMonthlyWeeklyBreakdown(entries: any[], monthStart: Date, monthEnd: Date): Array<{ weekStart: Date; weekEnd: Date; duration: number }> {
        const weeks: Array<{ weekStart: Date; weekEnd: Date; duration: number }> = [];
        const current = new Date(monthStart);

        // Find the first Monday of the month or before
        while (current.getDay() !== 1) {
            current.setDate(current.getDate() - 1);
        }

        while (current <= monthEnd) {
            const weekStart = new Date(current);
            const weekEnd = new Date(current);
            weekEnd.setDate(current.getDate() + 6);

            const weekEntries = entries.filter((entry: any) => {
                const entryDate = new Date(entry.start_time);
                return entryDate >= weekStart && entryDate <= weekEnd;
            });

            const duration = weekEntries.reduce((sum: number, entry: any) => sum + entry.duration, 0);

            weeks.push({ weekStart, weekEnd, duration });
            current.setDate(current.getDate() + 7);
        }

        return weeks;
    }

    private calculateStreakDays(sortedDates: string[]): number {
        if (sortedDates.length === 0) return 0;

        let streak = 1;
        let maxStreak = 1;

        for (let i = 1; i < sortedDates.length; i++) {
            const prevDate = new Date(sortedDates[i - 1]);
            const currDate = new Date(sortedDates[i]);
            const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                streak++;
                maxStreak = Math.max(maxStreak, streak);
            } else {
                streak = 1;
            }
        }

        return maxStreak;
    }
}