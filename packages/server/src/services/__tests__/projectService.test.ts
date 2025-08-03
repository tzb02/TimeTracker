import { ProjectService } from '../projectService';
import { getDatabase } from '../../database';
import { CreateProjectRequest, UpdateProjectRequest } from '../../types/models';

// Mock the database connection
jest.mock('../../database');
const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('ProjectService', () => {
  let projectService: ProjectService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      transaction: jest.fn()
    };
    mockGetDatabase.mockReturnValue(mockDb);
    projectService = new ProjectService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    const userId = 'user-123';
    const mockProjectRow = {
      id: 'project-123',
      name: 'Test Project',
      color: '#3B82F6',
      description: 'Test description',
      user_id: userId,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    it('should create a project successfully', async () => {
      const request: CreateProjectRequest = {
        name: 'Test Project',
        color: '#3B82F6',
        description: 'Test description'
      };

      // Mock existing project check (no conflicts)
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // Mock project creation
      mockDb.query.mockResolvedValueOnce({ rows: [mockProjectRow] });

      const result = await projectService.createProject(userId, request);

      expect(result).toEqual({
        id: 'project-123',
        name: 'Test Project',
        color: '#3B82F6',
        description: 'Test description',
        userId: userId,
        isActive: true,
        createdAt: mockProjectRow.created_at,
        updatedAt: mockProjectRow.updated_at
      });

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).toHaveBeenNthCalledWith(1,
        'SELECT id FROM projects WHERE user_id = $1 AND name = $2 AND is_active = true',
        [userId, 'Test Project']
      );
      expect(mockDb.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('INSERT INTO projects'),
        ['Test Project', '#3B82F6', 'Test description', userId, true]
      );
    });

    it('should use default color when not provided', async () => {
      const request: CreateProjectRequest = {
        name: 'Test Project'
      };

      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ ...mockProjectRow, color: '#3B82F6' }] });

      await projectService.createProject(userId, request);

      expect(mockDb.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('INSERT INTO projects'),
        ['Test Project', '#3B82F6', undefined, userId, true]
      );
    });

    it('should throw error for invalid color format', async () => {
      const request: CreateProjectRequest = {
        name: 'Test Project',
        color: 'invalid-color'
      };

      await expect(projectService.createProject(userId, request))
        .rejects.toThrow('Color must be a valid hex color code (e.g., #3B82F6)');

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should throw error when project name already exists', async () => {
      const request: CreateProjectRequest = {
        name: 'Existing Project'
      };

      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'existing-id' }] });

      await expect(projectService.createProject(userId, request))
        .rejects.toThrow('Project with this name already exists');

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should trim whitespace from name and description', async () => {
      const request: CreateProjectRequest = {
        name: '  Test Project  ',
        description: '  Test description  '
      };

      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockDb.query.mockResolvedValueOnce({ rows: [mockProjectRow] });

      await projectService.createProject(userId, request);

      expect(mockDb.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('INSERT INTO projects'),
        ['Test Project', '#3B82F6', 'Test description', userId, true]
      );
    });
  });

  describe('getProjects', () => {
    const userId = 'user-123';
    const mockProjectRows = [
      {
        id: 'project-1',
        name: 'Project A',
        color: '#3B82F6',
        description: 'Description A',
        user_id: userId,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'project-2',
        name: 'Project B',
        color: '#EF4444',
        description: 'Description B',
        user_id: userId,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    it('should get active projects by default', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: mockProjectRows });

      const result = await projectService.getProjects(userId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Project A');
      expect(result[1].name).toBe('Project B');

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM projects WHERE user_id = $1 AND is_active = true ORDER BY name ASC',
        [userId]
      );
    });

    it('should include inactive projects when requested', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: mockProjectRows });

      await projectService.getProjects(userId, true);

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM projects WHERE user_id = $1 ORDER BY name ASC',
        [userId]
      );
    });

    it('should return empty array when no projects found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await projectService.getProjects(userId);

      expect(result).toEqual([]);
    });
  });

  describe('getProjectById', () => {
    const userId = 'user-123';
    const projectId = 'project-123';
    const mockProjectRow = {
      id: projectId,
      name: 'Test Project',
      color: '#3B82F6',
      description: 'Test description',
      user_id: userId,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    it('should return project when found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [mockProjectRow] });

      const result = await projectService.getProjectById(userId, projectId);

      expect(result).toEqual({
        id: projectId,
        name: 'Test Project',
        color: '#3B82F6',
        description: 'Test description',
        userId: userId,
        isActive: true,
        createdAt: mockProjectRow.created_at,
        updatedAt: mockProjectRow.updated_at
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );
    });

    it('should return null when project not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await projectService.getProjectById(userId, projectId);

      expect(result).toBeNull();
    });
  });

  describe('updateProject', () => {
    const userId = 'user-123';
    const projectId = 'project-123';
    const existingProject = {
      id: projectId,
      name: 'Original Name',
      color: '#3B82F6',
      description: 'Original description',
      userId: userId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    beforeEach(() => {
      // Mock getProjectById call
      jest.spyOn(projectService, 'getProjectById').mockResolvedValue(existingProject);
    });

    it('should update project successfully', async () => {
      const request: UpdateProjectRequest = {
        name: 'Updated Name',
        color: '#EF4444',
        description: 'Updated description'
      };

      const updatedProjectRow = {
        id: projectId,
        name: 'Updated Name',
        color: '#EF4444',
        description: 'Updated description',
        user_id: userId,
        is_active: true,
        created_at: existingProject.createdAt,
        updated_at: new Date()
      };

      // Mock name conflict check
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // Mock update query
      mockDb.query.mockResolvedValueOnce({ rows: [updatedProjectRow] });

      const result = await projectService.updateProject(userId, projectId, request);

      expect(result.name).toBe('Updated Name');
      expect(result.color).toBe('#EF4444');
      expect(result.description).toBe('Updated description');

      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should return existing project when no changes provided', async () => {
      const request: UpdateProjectRequest = {};

      const result = await projectService.updateProject(userId, projectId, request);

      expect(result).toEqual(existingProject);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should throw error when project not found', async () => {
      jest.spyOn(projectService, 'getProjectById').mockResolvedValue(null);

      const request: UpdateProjectRequest = { name: 'New Name' };

      await expect(projectService.updateProject(userId, projectId, request))
        .rejects.toThrow('Project not found or not accessible');
    });

    it('should throw error for invalid color format', async () => {
      const request: UpdateProjectRequest = {
        color: 'invalid-color'
      };

      await expect(projectService.updateProject(userId, projectId, request))
        .rejects.toThrow('Color must be a valid hex color code (e.g., #3B82F6)');
    });

    it('should throw error when new name conflicts with existing project', async () => {
      const request: UpdateProjectRequest = {
        name: 'Conflicting Name'
      };

      // Mock name conflict check
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'other-project-id' }] });

      await expect(projectService.updateProject(userId, projectId, request))
        .rejects.toThrow('Project with this name already exists');
    });
  });

  describe('deleteProject', () => {
    const userId = 'user-123';
    const projectId = 'project-123';
    const existingProject = {
      id: projectId,
      name: 'Test Project',
      color: '#3B82F6',
      description: 'Test description',
      userId: userId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    beforeEach(() => {
      jest.spyOn(projectService, 'getProjectById').mockResolvedValue(existingProject);
    });

    it('should soft delete project when it has time entries', async () => {
      // Mock time entries check (has entries)
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });
      // Mock soft delete
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await projectService.deleteProject(userId, projectId);

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).toHaveBeenNthCalledWith(1,
        'SELECT COUNT(*) as count FROM time_entries WHERE project_id = $1',
        [projectId]
      );
      expect(mockDb.query).toHaveBeenNthCalledWith(2,
        'UPDATE projects SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );
    });

    it('should hard delete project when it has no time entries', async () => {
      // Mock time entries check (no entries)
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // Mock hard delete
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await projectService.deleteProject(userId, projectId);

      expect(mockDb.query).toHaveBeenCalledTimes(2);
      expect(mockDb.query).toHaveBeenNthCalledWith(2,
        'DELETE FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );
    });

    it('should throw error when project not found', async () => {
      jest.spyOn(projectService, 'getProjectById').mockResolvedValue(null);

      await expect(projectService.deleteProject(userId, projectId))
        .rejects.toThrow('Project not found or not accessible');

      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('searchProjects', () => {
    const userId = 'user-123';

    it('should search projects by name', async () => {
      const mockProjectRows = [
        {
          id: 'project-1',
          name: 'Test Project',
          color: '#3B82F6',
          description: 'Description',
          user_id: userId,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockProjectRows });

      const result = await projectService.searchProjects(userId, 'Test');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Project');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('name ILIKE $2'),
        [userId, '%Test%']
      );
    });
  });

  describe('getUsedColors', () => {
    const userId = 'user-123';

    it('should return distinct colors in use', async () => {
      const mockColorRows = [
        { color: '#3B82F6' },
        { color: '#EF4444' },
        { color: '#10B981' }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockColorRows });

      const result = await projectService.getUsedColors(userId);

      expect(result).toEqual(['#3B82F6', '#EF4444', '#10B981']);

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT DISTINCT color FROM projects WHERE user_id = $1 AND is_active = true ORDER BY color',
        [userId]
      );
    });
  });

  describe('validateProjectOwnership', () => {
    const userId = 'user-123';
    const projectId = 'project-123';

    it('should return true when user owns project', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: projectId }] });

      const result = await projectService.validateProjectOwnership(userId, projectId);

      expect(result).toBe(true);
    });

    it('should return false when user does not own project', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await projectService.validateProjectOwnership(userId, projectId);

      expect(result).toBe(false);
    });
  });
});