import request from 'supertest';
import express from 'express';
import projectRoutes from '../projects';

// Mock the project service
const mockProjectService = {
  getProjects: jest.fn(),
  createProject: jest.fn(),
  getProjectById: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  searchProjects: jest.fn(),
  getProjectsWithStats: jest.fn(),
  getUsedColors: jest.fn(),
  validateProjectOwnership: jest.fn()
};

jest.mock('../../services/projectService', () => {
  return {
    ProjectService: jest.fn().mockImplementation(() => mockProjectService)
  };
});

// Mock the authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: jest.fn((req: any, res: any, next: any) => {
    req.user = {
      userId: 'test-user-id',
      email: 'test@example.com',
      role: 'user'
    };
    next();
  })
}));

describe('Project Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/projects', projectRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/projects', () => {
    const mockProjects = [
      {
        id: 'project-1',
        name: 'Project A',
        color: '#3B82F6',
        description: 'Description A',
        userId: 'test-user-id',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    it('should get all active projects by default', async () => {
      mockProjectService.getProjects.mockResolvedValue(mockProjects);

      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          projects: mockProjects,
          count: 1
        }
      });

      expect(mockProjectService.getProjects).toHaveBeenCalledWith('test-user-id', false);
    });

    it('should include inactive projects when requested', async () => {
      mockProjectService.getProjects.mockResolvedValue(mockProjects);

      await request(app)
        .get('/api/projects?includeInactive=true')
        .expect(200);

      expect(mockProjectService.getProjects).toHaveBeenCalledWith('test-user-id', true);
    });

    it('should get projects with stats when requested', async () => {
      const mockProjectsWithStats = mockProjects.map(p => ({
        ...p,
        totalTime: 3600,
        entryCount: 5
      }));

      mockProjectService.getProjectsWithStats.mockResolvedValue(mockProjectsWithStats);

      const response = await request(app)
        .get('/api/projects?withStats=true')
        .expect(200);

      expect(response.body.data.projects[0]).toHaveProperty('totalTime');
      expect(response.body.data.projects[0]).toHaveProperty('entryCount');
      expect(mockProjectService.getProjectsWithStats).toHaveBeenCalledWith('test-user-id', false);
    });

    it('should search projects when search term provided', async () => {
      mockProjectService.searchProjects.mockResolvedValue([mockProjects[0]]);

      const response = await request(app)
        .get('/api/projects?search=Project A')
        .expect(200);

      expect(response.body.data.projects).toHaveLength(1);
      expect(mockProjectService.searchProjects).toHaveBeenCalledWith('test-user-id', 'Project A', false);
    });

    it('should handle service errors', async () => {
      mockProjectService.getProjects.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/projects')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get projects'
        }
      });
    });
  });

  describe('GET /api/projects/:id', () => {
    const mockProject = {
      id: 'project-123',
      name: 'Test Project',
      color: '#3B82F6',
      description: 'Test description',
      userId: 'test-user-id',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should get project by ID', async () => {
      mockProjectService.getProjectById.mockResolvedValue(mockProject);

      const response = await request(app)
        .get('/api/projects/project-123')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          project: mockProject
        }
      });

      expect(mockProjectService.getProjectById).toHaveBeenCalledWith('test-user-id', 'project-123');
    });

    it('should return 404 when project not found', async () => {
      mockProjectService.getProjectById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/projects/nonexistent-id')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or not accessible'
        }
      });
    });
  });

  describe('POST /api/projects', () => {
    const mockProject = {
      id: 'project-123',
      name: 'New Project',
      color: '#3B82F6',
      description: 'New description',
      userId: 'test-user-id',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should create a new project', async () => {
      mockProjectService.createProject.mockResolvedValue(mockProject);

      const projectData = {
        name: 'New Project',
        color: '#3B82F6',
        description: 'New description'
      };

      const response = await request(app)
        .post('/api/projects')
        .send(projectData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: {
          project: mockProject,
          message: 'Project created successfully'
        }
      });

      expect(mockProjectService.createProject).toHaveBeenCalledWith('test-user-id', projectData);
    });

    it('should return 409 when project name already exists', async () => {
      mockProjectService.createProject.mockRejectedValue(new Error('Project with this name already exists'));

      const response = await request(app)
        .post('/api/projects')
        .send({
          name: 'Existing Project'
        })
        .expect(409);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'PROJECT_NAME_EXISTS',
          message: 'Project with this name already exists'
        }
      });
    });
  });

  describe('PUT /api/projects/:id', () => {
    const mockProject = {
      id: 'project-123',
      name: 'Updated Project',
      color: '#EF4444',
      description: 'Updated description',
      userId: 'test-user-id',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should update a project', async () => {
      mockProjectService.updateProject.mockResolvedValue(mockProject);

      const updateData = {
        name: 'Updated Project',
        color: '#EF4444',
        description: 'Updated description'
      };

      const response = await request(app)
        .put('/api/projects/project-123')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          project: mockProject,
          message: 'Project updated successfully'
        }
      });

      expect(mockProjectService.updateProject).toHaveBeenCalledWith('test-user-id', 'project-123', updateData);
    });

    it('should return 404 when project not found', async () => {
      mockProjectService.updateProject.mockRejectedValue(new Error('Project not found or not accessible'));

      const response = await request(app)
        .put('/api/projects/nonexistent-id')
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or not accessible'
        }
      });
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete a project', async () => {
      mockProjectService.deleteProject.mockResolvedValue();

      const response = await request(app)
        .delete('/api/projects/project-123')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          message: 'Project deleted successfully'
        }
      });

      expect(mockProjectService.deleteProject).toHaveBeenCalledWith('test-user-id', 'project-123');
    });

    it('should return 404 when project not found', async () => {
      mockProjectService.deleteProject.mockRejectedValue(new Error('Project not found or not accessible'));

      const response = await request(app)
        .delete('/api/projects/nonexistent-id')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or not accessible'
        }
      });
    });
  });

  describe('GET /api/projects/colors/used', () => {
    it('should get used colors', async () => {
      const mockColors = ['#3B82F6', '#EF4444', '#10B981'];
      mockProjectService.getUsedColors.mockResolvedValue(mockColors);

      const response = await request(app)
        .get('/api/projects/colors/used')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          colors: mockColors,
          count: 3
        }
      });

      expect(mockProjectService.getUsedColors).toHaveBeenCalledWith('test-user-id');
    });
  });
});