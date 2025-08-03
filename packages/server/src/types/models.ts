// Core data model interfaces for the time tracker application

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  organizationId?: string;
  role: 'admin' | 'user';
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  defaultProject?: string;
  timeFormat: '12h' | '24h';
  weekStartDay: number; // 0 = Sunday, 1 = Monday, etc.
  notifications: boolean;
}

export interface Project {
  id: string;
  name: string;
  color: string; // Hex color code
  description?: string;
  userId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  description: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // Duration in seconds
  isRunning: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TimerState {
  isRunning: boolean;
  currentEntry?: TimeEntry;
  startTime?: Date;
  elapsedTime: number; // Elapsed time in seconds
  lastSync: Date;
}

// Database row interfaces (matching the actual database schema)
export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  organization_id?: string;
  role: 'admin' | 'user';
  preferences: UserPreferences;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectRow {
  id: string;
  name: string;
  color: string;
  description?: string;
  user_id: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TimeEntryRow {
  id: string;
  user_id: string;
  project_id: string;
  description: string;
  start_time: Date;
  end_time?: Date;
  duration: number;
  is_running: boolean;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

// API request/response interfaces
export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  organizationId?: string;
}

export interface CreateProjectRequest {
  name: string;
  color?: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  color?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateTimeEntryRequest {
  projectId: string;
  description?: string;
  startTime?: Date;
}

export interface UpdateTimeEntryRequest {
  projectId?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  tags?: string[];
}

export interface StartTimerRequest {
  projectId: string;
  description?: string;
}

export interface StopTimerRequest {
  endTime?: Date;
}

// Utility types for database operations
export type CreateUser = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateUser = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>;

export type CreateProject = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateProject = Partial<Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>;

export type CreateTimeEntry = Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateTimeEntry = Partial<Omit<TimeEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>;