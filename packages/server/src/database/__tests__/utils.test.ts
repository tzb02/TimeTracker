import {
  mapUserRowToUser,
  mapProjectRowToProject,
  mapTimeEntryRowToTimeEntry,
  mapUserToUserRow,
  mapProjectToProjectRow,
  mapTimeEntryToTimeEntryRow,
  buildWhereClause,
  buildUpdateClause,
  isValidUUID,
  calculateDuration,
  formatDuration,
} from '../utils';
import { UserRow, ProjectRow, TimeEntryRow, User, Project, TimeEntry } from '../../types/models';

describe('Database Utils', () => {
  describe('Row to Model Mapping', () => {
    it('should map UserRow to User correctly', () => {
      const userRow: UserRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashedpassword',
        organization_id: '123e4567-e89b-12d3-a456-426614174001',
        role: 'user',
        preferences: { timeFormat: '24h', weekStartDay: 1, notifications: true },
        created_at: new Date('2023-01-01'),
        updated_at: new Date('2023-01-02'),
      };

      const user = mapUserRowToUser(userRow);

      expect(user).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashedpassword',
        organizationId: '123e4567-e89b-12d3-a456-426614174001',
        role: 'user',
        preferences: { timeFormat: '24h', weekStartDay: 1, notifications: true },
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      });
    });

    it('should map ProjectRow to Project correctly', () => {
      const projectRow: ProjectRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Project',
        color: '#FF0000',
        description: 'A test project',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        is_active: true,
        created_at: new Date('2023-01-01'),
        updated_at: new Date('2023-01-02'),
      };

      const project = mapProjectRowToProject(projectRow);

      expect(project).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Project',
        color: '#FF0000',
        description: 'A test project',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        isActive: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      });
    });

    it('should map TimeEntryRow to TimeEntry correctly', () => {
      const timeEntryRow: TimeEntryRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        project_id: '123e4567-e89b-12d3-a456-426614174002',
        description: 'Working on feature',
        start_time: new Date('2023-01-01T10:00:00Z'),
        end_time: new Date('2023-01-01T12:00:00Z'),
        duration: 7200,
        is_running: false,
        tags: ['development', 'feature'],
        created_at: new Date('2023-01-01'),
        updated_at: new Date('2023-01-02'),
      };

      const timeEntry = mapTimeEntryRowToTimeEntry(timeEntryRow);

      expect(timeEntry).toEqual({
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        projectId: '123e4567-e89b-12d3-a456-426614174002',
        description: 'Working on feature',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T12:00:00Z'),
        duration: 7200,
        isRunning: false,
        tags: ['development', 'feature'],
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      });
    });
  });

  describe('Model to Row Mapping', () => {
    it('should map User to UserRow correctly', () => {
      const user: Partial<User> = {
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashedpassword',
        role: 'admin',
      };

      const userRow = mapUserToUserRow(user);

      expect(userRow).toEqual({
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashedpassword',
        role: 'admin',
      });
    });
  });

  describe('Query Building', () => {
    it('should build WHERE clause correctly', () => {
      const conditions = {
        user_id: '123',
        is_active: true,
        name: 'Test',
      };

      const result = buildWhereClause(conditions);

      expect(result.clause).toBe('WHERE user_id = $1 AND is_active = $2 AND name = $3');
      expect(result.values).toEqual(['123', true, 'Test']);
    });

    it('should handle empty conditions', () => {
      const result = buildWhereClause({});
      expect(result.clause).toBe('');
      expect(result.values).toEqual([]);
    });

    it('should build UPDATE clause correctly', () => {
      const updates = {
        name: 'Updated Name',
        is_active: false,
      };

      const result = buildUpdateClause(updates);

      expect(result.clause).toBe('SET name = $1, is_active = $2');
      expect(result.values).toEqual(['Updated Name', false]);
    });
  });

  describe('Utility Functions', () => {
    it('should validate UUID correctly', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('invalid-uuid')).toBe(false);
      expect(isValidUUID('')).toBe(false);
    });

    it('should calculate duration correctly', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const endTime = new Date('2023-01-01T12:00:00Z');
      
      const duration = calculateDuration(startTime, endTime);
      expect(duration).toBe(7200); // 2 hours in seconds
    });

    it('should format duration correctly', () => {
      expect(formatDuration(3661)).toBe('1h 1m 1s');
      expect(formatDuration(61)).toBe('1m 1s');
      expect(formatDuration(30)).toBe('30s');
      expect(formatDuration(0)).toBe('0s');
    });
  });
});