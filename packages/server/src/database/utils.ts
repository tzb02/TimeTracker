import { UserRow, ProjectRow, TimeEntryRow, User, Project, TimeEntry } from '../types/models';

/**
 * Convert database row to User model
 */
export function mapUserRowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    organizationId: row.organization_id,
    role: row.role,
    preferences: row.preferences,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert database row to Project model
 */
export function mapProjectRowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    description: row.description,
    userId: row.user_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert database row to TimeEntry model
 */
export function mapTimeEntryRowToTimeEntry(row: TimeEntryRow): TimeEntry {
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
    updatedAt: row.updated_at,
  };
}

/**
 * Convert User model to database row format
 */
export function mapUserToUserRow(user: Partial<User>): Partial<UserRow> {
  const row: Partial<UserRow> = {};
  
  if (user.id !== undefined) row.id = user.id;
  if (user.email !== undefined) row.email = user.email;
  if (user.name !== undefined) row.name = user.name;
  if (user.passwordHash !== undefined) row.password_hash = user.passwordHash;
  if (user.organizationId !== undefined) row.organization_id = user.organizationId;
  if (user.role !== undefined) row.role = user.role;
  if (user.preferences !== undefined) row.preferences = user.preferences;
  if (user.createdAt !== undefined) row.created_at = user.createdAt;
  if (user.updatedAt !== undefined) row.updated_at = user.updatedAt;
  
  return row;
}

/**
 * Convert Project model to database row format
 */
export function mapProjectToProjectRow(project: Partial<Project>): Partial<ProjectRow> {
  const row: Partial<ProjectRow> = {};
  
  if (project.id !== undefined) row.id = project.id;
  if (project.name !== undefined) row.name = project.name;
  if (project.color !== undefined) row.color = project.color;
  if (project.description !== undefined) row.description = project.description;
  if (project.userId !== undefined) row.user_id = project.userId;
  if (project.isActive !== undefined) row.is_active = project.isActive;
  if (project.createdAt !== undefined) row.created_at = project.createdAt;
  if (project.updatedAt !== undefined) row.updated_at = project.updatedAt;
  
  return row;
}

/**
 * Convert TimeEntry model to database row format
 */
export function mapTimeEntryToTimeEntryRow(timeEntry: Partial<TimeEntry>): Partial<TimeEntryRow> {
  const row: Partial<TimeEntryRow> = {};
  
  if (timeEntry.id !== undefined) row.id = timeEntry.id;
  if (timeEntry.userId !== undefined) row.user_id = timeEntry.userId;
  if (timeEntry.projectId !== undefined) row.project_id = timeEntry.projectId;
  if (timeEntry.description !== undefined) row.description = timeEntry.description;
  if (timeEntry.startTime !== undefined) row.start_time = timeEntry.startTime;
  if (timeEntry.endTime !== undefined) row.end_time = timeEntry.endTime;
  if (timeEntry.duration !== undefined) row.duration = timeEntry.duration;
  if (timeEntry.isRunning !== undefined) row.is_running = timeEntry.isRunning;
  if (timeEntry.tags !== undefined) row.tags = timeEntry.tags;
  if (timeEntry.createdAt !== undefined) row.created_at = timeEntry.createdAt;
  if (timeEntry.updatedAt !== undefined) row.updated_at = timeEntry.updatedAt;
  
  return row;
}

/**
 * Build dynamic WHERE clause for queries
 */
export function buildWhereClause(conditions: Record<string, any>): { clause: string; values: any[] } {
  const clauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(conditions)) {
    if (value !== undefined && value !== null) {
      clauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  return {
    clause: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  };
}

/**
 * Build dynamic UPDATE SET clause for queries
 */
export function buildUpdateClause(updates: Record<string, any>): { clause: string; values: any[] } {
  const clauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      clauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  return {
    clause: clauses.length > 0 ? `SET ${clauses.join(', ')}` : '',
    values,
  };
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Calculate duration between two dates in seconds
 */
export function calculateDuration(startTime: Date, endTime: Date): number {
  return Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
}

/**
 * Format duration in seconds to human readable format
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
}