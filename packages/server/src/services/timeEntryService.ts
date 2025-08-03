import { getDatabase } from '../database';
import { 
  TimeEntry, 
  TimeEntryRow, 
  CreateTimeEntry, 
  UpdateTimeEntry,
  CreateTimeEntryRequest,
  UpdateTimeEntryRequest 
} from '../types/models';

export interface TimeEntryFilters {
  projectId?: string;
  startDate?: Date;
  endDate?: Date;
  isRunning?: boolean;
  tags?: string[];
  search?: string;
}

export interface TimeEntryStats {
  totalEntries: number;
  totalDuration: number;
  averageDuration: number;
  longestEntry: number;
  shortestEntry: number;
}

export interface BulkUpdateRequest {
  entryIds: string[];
  updates: Partial<UpdateTimeEntryRequest>;
}

export interface BulkDeleteRequest {
  entryIds: string[];
}

export class TimeEntryService {
  private db = getDatabase();

  /**
   * Convert database row to TimeEntry model
   */
  private rowToTimeEntry(row: TimeEntryRow): TimeEntry {
    return {
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      description: row.description,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration,
      isRunning: row.is_running,
      tags: row.tags,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Create a new time entry
   */
  async createTimeEntry(userId: string, request: CreateTimeEntryRequest): Promise<TimeEntry> {
    // Validate project ownership
    const projectCheck = await this.db.query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [request.projectId, userId]
    );

    if (projectCheck.rows.length === 0) {
      throw new Error('Project not found or not accessible');
    }

    // Check if user already has a running timer
    const runningTimer = await this.db.query(
      'SELECT id FROM time_entries WHERE user_id = $1 AND is_running = true',
      [userId]
    );

    if (runningTimer.rows.length > 0) {
      throw new Error('Cannot create time entry while another timer is running');
    }

    const startTime = request.startTime || new Date();
    
    const entryData: CreateTimeEntry = {
      userId,
      projectId: request.projectId,
      description: request.description || '',
      startTime,
      endTime: undefined,
      duration: 0,
      isRunning: false,
      tags: []
    };

    const result = await this.db.query(
      `INSERT INTO time_entries (user_id, project_id, description, start_time, end_time, duration, is_running, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        entryData.userId,
        entryData.projectId,
        entryData.description,
        entryData.startTime,
        entryData.endTime || null,
        entryData.duration,
        entryData.isRunning,
        entryData.tags
      ]
    );

    return this.rowToTimeEntry(result.rows[0]);
  } 
 /**
   * Get time entries for a user with optional filtering
   */
  async getTimeEntries(
    userId: string, 
    filters: TimeEntryFilters = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<{ entries: TimeEntry[]; total: number }> {
    let query = `
      SELECT te.*, p.name as project_name, p.color as project_color
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      WHERE te.user_id = $1
    `;
    
    const params: any[] = [userId];
    let paramIndex = 2;

    // Apply filters
    if (filters.projectId) {
      query += ` AND te.project_id = $${paramIndex++}`;
      params.push(filters.projectId);
    }

    if (filters.startDate) {
      query += ` AND te.start_time >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND te.start_time <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    if (filters.isRunning !== undefined) {
      query += ` AND te.is_running = $${paramIndex++}`;
      params.push(filters.isRunning);
    }

    if (filters.tags && filters.tags.length > 0) {
      query += ` AND te.tags && $${paramIndex++}`;
      params.push(filters.tags);
    }

    if (filters.search) {
      query += ` AND (te.description ILIKE $${paramIndex++} OR p.name ILIKE $${paramIndex++})`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
      paramIndex++; // Account for the second parameter
    }

    // Get total count
    const countQuery = query.replace(
      'SELECT te.*, p.name as project_name, p.color as project_color',
      'SELECT COUNT(*)'
    );
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add ordering and pagination
    query += ` ORDER BY te.start_time DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    const entries = result.rows.map((row: any) => ({
      ...this.rowToTimeEntry(row),
      projectName: row.project_name,
      projectColor: row.project_color
    }));

    return { entries, total };
  }

  /**
   * Get a specific time entry by ID
   */
  async getTimeEntryById(userId: string, entryId: string): Promise<TimeEntry | null> {
    const result = await this.db.query(
      'SELECT * FROM time_entries WHERE id = $1 AND user_id = $2',
      [entryId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToTimeEntry(result.rows[0]);
  }

  /**
   * Update a time entry
   */
  async updateTimeEntry(userId: string, entryId: string, request: UpdateTimeEntryRequest): Promise<TimeEntry> {
    // First check if entry exists and belongs to user
    const existingEntry = await this.getTimeEntryById(userId, entryId);
    if (!existingEntry) {
      throw new Error('Time entry not found or not accessible');
    }

    // Validate project ownership if projectId is being changed
    if (request.projectId && request.projectId !== existingEntry.projectId) {
      const projectCheck = await this.db.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [request.projectId, userId]
      );

      if (projectCheck.rows.length === 0) {
        throw new Error('Project not found or not accessible');
      }
    }

    // Validate time constraints
    if (request.startTime && request.endTime && request.startTime >= request.endTime) {
      throw new Error('End time must be after start time');
    }

    // Calculate duration if both start and end times are provided
    let calculatedDuration = request.duration;
    if (request.startTime && request.endTime) {
      calculatedDuration = Math.floor((request.endTime.getTime() - request.startTime.getTime()) / 1000);
    } else if (request.startTime && existingEntry.endTime) {
      calculatedDuration = Math.floor((existingEntry.endTime.getTime() - request.startTime.getTime()) / 1000);
    } else if (request.endTime && existingEntry.startTime) {
      calculatedDuration = Math.floor((request.endTime.getTime() - existingEntry.startTime.getTime()) / 1000);
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (request.projectId !== undefined) {
      updateFields.push(`project_id = $${paramIndex++}`);
      updateValues.push(request.projectId);
    }

    if (request.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(request.description);
    }

    if (request.startTime !== undefined) {
      updateFields.push(`start_time = $${paramIndex++}`);
      updateValues.push(request.startTime);
    }

    if (request.endTime !== undefined) {
      updateFields.push(`end_time = $${paramIndex++}`);
      updateValues.push(request.endTime);
    }

    if (calculatedDuration !== undefined) {
      updateFields.push(`duration = $${paramIndex++}`);
      updateValues.push(calculatedDuration);
    }

    if (request.tags !== undefined) {
      updateFields.push(`tags = $${paramIndex++}`);
      updateValues.push(request.tags);
    }

    if (updateFields.length === 0) {
      return existingEntry; // No changes to make
    }

    // Add WHERE clause parameters
    updateValues.push(entryId, userId);

    const query = `
      UPDATE time_entries 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
      RETURNING *
    `;

    const result = await this.db.query(query, updateValues);
    return this.rowToTimeEntry(result.rows[0]);
  }

  /**
   * Delete a time entry
   */
  async deleteTimeEntry(userId: string, entryId: string): Promise<void> {
    // First check if entry exists and belongs to user
    const existingEntry = await this.getTimeEntryById(userId, entryId);
    if (!existingEntry) {
      throw new Error('Time entry not found or not accessible');
    }

    await this.db.query(
      'DELETE FROM time_entries WHERE id = $1 AND user_id = $2',
      [entryId, userId]
    );
  }  /*
*
   * Bulk update time entries
   */
  async bulkUpdateTimeEntries(userId: string, request: BulkUpdateRequest): Promise<TimeEntry[]> {
    if (request.entryIds.length === 0) {
      return [];
    }

    // Verify all entries belong to the user
    const ownershipCheck = await this.db.query(
      'SELECT id FROM time_entries WHERE id = ANY($1) AND user_id = $2',
      [request.entryIds, userId]
    );

    if (ownershipCheck.rows.length !== request.entryIds.length) {
      throw new Error('One or more time entries not found or not accessible');
    }

    // Validate project ownership if projectId is being changed
    if (request.updates.projectId) {
      const projectCheck = await this.db.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [request.updates.projectId, userId]
      );

      if (projectCheck.rows.length === 0) {
        throw new Error('Project not found or not accessible');
      }
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (request.updates.projectId !== undefined) {
      updateFields.push(`project_id = $${paramIndex++}`);
      updateValues.push(request.updates.projectId);
    }

    if (request.updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(request.updates.description);
    }

    if (request.updates.tags !== undefined) {
      updateFields.push(`tags = $${paramIndex++}`);
      updateValues.push(request.updates.tags);
    }

    if (updateFields.length === 0) {
      // No updates to make, return current entries
      const result = await this.db.query(
        'SELECT * FROM time_entries WHERE id = ANY($1) AND user_id = $2 ORDER BY start_time DESC',
        [request.entryIds, userId]
      );
      return result.rows.map(this.rowToTimeEntry);
    }

    // Add WHERE clause parameters
    updateValues.push(request.entryIds, userId);

    const query = `
      UPDATE time_entries 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($${paramIndex++}) AND user_id = $${paramIndex++}
      RETURNING *
    `;

    const result = await this.db.query(query, updateValues);
    return result.rows.map(this.rowToTimeEntry);
  }

  /**
   * Bulk delete time entries
   */
  async bulkDeleteTimeEntries(userId: string, request: BulkDeleteRequest): Promise<void> {
    if (request.entryIds.length === 0) {
      return;
    }

    // Verify all entries belong to the user
    const ownershipCheck = await this.db.query(
      'SELECT id FROM time_entries WHERE id = ANY($1) AND user_id = $2',
      [request.entryIds, userId]
    );

    if (ownershipCheck.rows.length !== request.entryIds.length) {
      throw new Error('One or more time entries not found or not accessible');
    }

    await this.db.query(
      'DELETE FROM time_entries WHERE id = ANY($1) AND user_id = $2',
      [request.entryIds, userId]
    );
  }

  /**
   * Get time entry statistics for a user
   */
  async getTimeEntryStats(userId: string, filters: TimeEntryFilters = {}): Promise<TimeEntryStats> {
    let query = `
      SELECT 
        COUNT(*) as total_entries,
        COALESCE(SUM(duration), 0) as total_duration,
        COALESCE(AVG(duration), 0) as average_duration,
        COALESCE(MAX(duration), 0) as longest_entry,
        COALESCE(MIN(duration), 0) as shortest_entry
      FROM time_entries te
      WHERE te.user_id = $1 AND te.is_running = false
    `;
    
    const params: any[] = [userId];
    let paramIndex = 2;

    // Apply filters
    if (filters.projectId) {
      query += ` AND te.project_id = $${paramIndex++}`;
      params.push(filters.projectId);
    }

    if (filters.startDate) {
      query += ` AND te.start_time >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND te.start_time <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    if (filters.tags && filters.tags.length > 0) {
      query += ` AND te.tags && $${paramIndex++}`;
      params.push(filters.tags);
    }

    const result = await this.db.query(query, params);
    const row = result.rows[0];

    return {
      totalEntries: parseInt(row.total_entries) || 0,
      totalDuration: parseInt(row.total_duration) || 0,
      averageDuration: Math.round(parseFloat(row.average_duration)) || 0,
      longestEntry: parseInt(row.longest_entry) || 0,
      shortestEntry: parseInt(row.shortest_entry) || 0
    };
  }

  /**
   * Search time entries by description or project name
   */
  async searchTimeEntries(
    userId: string, 
    searchTerm: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ entries: TimeEntry[]; total: number }> {
    const query = `
      SELECT te.*, p.name as project_name, p.color as project_color
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      WHERE te.user_id = $1 AND (te.description ILIKE $2 OR p.name ILIKE $2)
      ORDER BY te.start_time DESC
      LIMIT $3 OFFSET $4
    `;

    const countQuery = `
      SELECT COUNT(*)
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      WHERE te.user_id = $1 AND (te.description ILIKE $2 OR p.name ILIKE $2)
    `;

    const searchPattern = `%${searchTerm}%`;
    const params = [userId, searchPattern];

    const [entriesResult, countResult] = await Promise.all([
      this.db.query(query, [...params, limit, offset]),
      this.db.query(countQuery, params)
    ]);

    const entries = entriesResult.rows.map((row: any) => ({
      ...this.rowToTimeEntry(row),
      projectName: row.project_name,
      projectColor: row.project_color
    }));

    const total = parseInt(countResult.rows[0].count);

    return { entries, total };
  }

  /**
   * Get time entries grouped by project
   */
  async getTimeEntriesByProject(
    userId: string,
    filters: TimeEntryFilters = {}
  ): Promise<Array<{ projectId: string; projectName: string; projectColor: string; entries: TimeEntry[]; totalDuration: number }>> {
    let query = `
      SELECT 
        te.*,
        p.name as project_name,
        p.color as project_color
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      WHERE te.user_id = $1
    `;
    
    const params: any[] = [userId];
    let paramIndex = 2;

    // Apply filters
    if (filters.startDate) {
      query += ` AND te.start_time >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND te.start_time <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    if (filters.isRunning !== undefined) {
      query += ` AND te.is_running = $${paramIndex++}`;
      params.push(filters.isRunning);
    }

    if (filters.tags && filters.tags.length > 0) {
      query += ` AND te.tags && $${paramIndex++}`;
      params.push(filters.tags);
    }

    query += ` ORDER BY p.name ASC, te.start_time DESC`;

    const result = await this.db.query(query, params);
    
    // Group entries by project
    const projectMap = new Map<string, {
      projectId: string;
      projectName: string;
      projectColor: string;
      entries: TimeEntry[];
      totalDuration: number;
    }>();

    result.rows.forEach((row: any) => {
      const entry = this.rowToTimeEntry(row);
      const projectId = row.project_id;
      
      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, {
          projectId,
          projectName: row.project_name,
          projectColor: row.project_color,
          entries: [],
          totalDuration: 0
        });
      }

      const projectData = projectMap.get(projectId)!;
      projectData.entries.push(entry);
      projectData.totalDuration += entry.duration;
    });

    return Array.from(projectMap.values());
  }

  /**
   * Validate time entry ownership
   */
  async validateTimeEntryOwnership(userId: string, entryId: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT id FROM time_entries WHERE id = $1 AND user_id = $2',
      [entryId, userId]
    );

    return result.rows.length > 0;
  }

  /**
   * Get running time entry for user
   */
  async getRunningTimeEntry(userId: string): Promise<TimeEntry | null> {
    const result = await this.db.query(
      'SELECT * FROM time_entries WHERE user_id = $1 AND is_running = true',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToTimeEntry(result.rows[0]);
  }
}