import { getDatabase } from '../database';
import { 
  Project, 
  ProjectRow, 
  CreateProject, 
  UpdateProject,
  CreateProjectRequest,
  UpdateProjectRequest 
} from '../types/models';

export class ProjectService {
  private db = getDatabase();

  /**
   * Convert database row to Project model
   */
  private rowToProject(row: ProjectRow): Project {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      description: row.description,
      userId: row.user_id,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Create a new project
   */
  async createProject(userId: string, request: CreateProjectRequest): Promise<Project> {
    // Validate color format if provided
    if (request.color && !/^#[0-9A-Fa-f]{6}$/.test(request.color)) {
      throw new Error('Color must be a valid hex color code (e.g., #3B82F6)');
    }

    // Check if project name already exists for this user
    const existingProject = await this.db.query(
      'SELECT id FROM projects WHERE user_id = $1 AND name = $2 AND is_active = true',
      [userId, request.name]
    );

    if (existingProject.rows.length > 0) {
      throw new Error('Project with this name already exists');
    }

    const projectData: CreateProject = {
      name: request.name.trim(),
      color: request.color || '#3B82F6',
      description: request.description?.trim(),
      userId,
      isActive: true
    };

    const result = await this.db.query(
      `INSERT INTO projects (name, color, description, user_id, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [projectData.name, projectData.color, projectData.description, projectData.userId, projectData.isActive]
    );

    return this.rowToProject(result.rows[0]);
  }

  /**
   * Get all projects for a user
   */
  async getProjects(userId: string, includeInactive: boolean = false): Promise<Project[]> {
    let query = 'SELECT * FROM projects WHERE user_id = $1';
    const params = [userId];

    if (!includeInactive) {
      query += ' AND is_active = true';
    }

    query += ' ORDER BY name ASC';

    const result = await this.db.query(query, params);
    return result.rows.map(this.rowToProject);
  }

  /**
   * Get a specific project by ID
   */
  async getProjectById(userId: string, projectId: string): Promise<Project | null> {
    const result = await this.db.query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToProject(result.rows[0]);
  }

  /**
   * Update a project
   */
  async updateProject(userId: string, projectId: string, request: UpdateProjectRequest): Promise<Project> {
    // First check if project exists and belongs to user
    const existingProject = await this.getProjectById(userId, projectId);
    if (!existingProject) {
      throw new Error('Project not found or not accessible');
    }

    // Validate color format if provided
    if (request.color && !/^#[0-9A-Fa-f]{6}$/.test(request.color)) {
      throw new Error('Color must be a valid hex color code (e.g., #3B82F6)');
    }

    // Check if new name conflicts with existing projects (if name is being changed)
    if (request.name && request.name !== existingProject.name) {
      const conflictingProject = await this.db.query(
        'SELECT id FROM projects WHERE user_id = $1 AND name = $2 AND id != $3 AND is_active = true',
        [userId, request.name, projectId]
      );

      if (conflictingProject.rows.length > 0) {
        throw new Error('Project with this name already exists');
      }
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (request.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(request.name.trim());
    }

    if (request.color !== undefined) {
      updateFields.push(`color = $${paramIndex++}`);
      updateValues.push(request.color);
    }

    if (request.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(request.description?.trim() || null);
    }

    if (request.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      updateValues.push(request.isActive);
    }

    if (updateFields.length === 0) {
      return existingProject; // No changes to make
    }

    // Add WHERE clause parameters
    updateValues.push(projectId, userId);

    const query = `
      UPDATE projects 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
      RETURNING *
    `;

    const result = await this.db.query(query, updateValues);
    return this.rowToProject(result.rows[0]);
  }

  /**
   * Delete a project (soft delete by setting is_active to false)
   */
  async deleteProject(userId: string, projectId: string): Promise<void> {
    // First check if project exists and belongs to user
    const existingProject = await this.getProjectById(userId, projectId);
    if (!existingProject) {
      throw new Error('Project not found or not accessible');
    }

    // Check if project has any time entries
    const timeEntriesResult = await this.db.query(
      'SELECT COUNT(*) as count FROM time_entries WHERE project_id = $1',
      [projectId]
    );

    const hasTimeEntries = parseInt(timeEntriesResult.rows[0].count) > 0;

    if (hasTimeEntries) {
      // Soft delete - set is_active to false
      await this.db.query(
        'UPDATE projects SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );
    } else {
      // Hard delete if no time entries exist
      await this.db.query(
        'DELETE FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );
    }
  }

  /**
   * Get projects with time entry statistics
   */
  async getProjectsWithStats(userId: string, includeInactive: boolean = false): Promise<Array<Project & { totalTime: number; entryCount: number }>> {
    let query = `
      SELECT 
        p.*,
        COALESCE(SUM(te.duration), 0) as total_time,
        COUNT(te.id) as entry_count
      FROM projects p
      LEFT JOIN time_entries te ON p.id = te.project_id
      WHERE p.user_id = $1
    `;

    const params = [userId];

    if (!includeInactive) {
      query += ' AND p.is_active = true';
    }

    query += `
      GROUP BY p.id, p.name, p.color, p.description, p.user_id, p.is_active, p.created_at, p.updated_at
      ORDER BY p.name ASC
    `;

    const result = await this.db.query(query, params);
    
    return result.rows.map((row: any) => ({
      ...this.rowToProject(row),
      totalTime: parseInt(row.total_time) || 0,
      entryCount: parseInt(row.entry_count) || 0
    }));
  }

  /**
   * Search projects by name
   */
  async searchProjects(userId: string, searchTerm: string, includeInactive: boolean = false): Promise<Project[]> {
    let query = `
      SELECT * FROM projects 
      WHERE user_id = $1 AND name ILIKE $2
    `;

    const params = [userId, `%${searchTerm}%`];

    if (!includeInactive) {
      query += ' AND is_active = true';
    }

    query += ' ORDER BY name ASC';

    const result = await this.db.query(query, params);
    return result.rows.map(this.rowToProject);
  }

  /**
   * Get project colors in use by the user
   */
  async getUsedColors(userId: string): Promise<string[]> {
    const result = await this.db.query(
      'SELECT DISTINCT color FROM projects WHERE user_id = $1 AND is_active = true ORDER BY color',
      [userId]
    );

    return result.rows.map((row: any) => row.color);
  }

  /**
   * Validate project ownership
   */
  async validateProjectOwnership(userId: string, projectId: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );

    return result.rows.length > 0;
  }
}