import { Router, Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { ProjectService } from '../services/projectService';
import { authenticateToken } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';
import { CreateProjectRequest, UpdateProjectRequest } from '../types/models';

const router = Router();
const projectService = new ProjectService();

// Apply authentication to all project routes
router.use(authenticateToken);

/**
 * GET /api/projects
 * Get all projects for the authenticated user
 */
router.get('/',
  [
    query('includeInactive')
      .optional()
      .isBoolean()
      .withMessage('includeInactive must be a boolean'),
    query('withStats')
      .optional()
      .isBoolean()
      .withMessage('withStats must be a boolean'),
    query('search')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search term must be between 1 and 100 characters')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const includeInactive = req.query.includeInactive === 'true';
      const withStats = req.query.withStats === 'true';
      const searchTerm = req.query.search as string;

      let projects;

      if (searchTerm) {
        projects = await projectService.searchProjects(userId, searchTerm, includeInactive);
      } else if (withStats) {
        projects = await projectService.getProjectsWithStats(userId, includeInactive);
      } else {
        projects = await projectService.getProjects(userId, includeInactive);
      }

      res.json({
        success: true,
        data: {
          projects,
          count: projects.length
        }
      });
    } catch (error) {
      console.error('Error getting projects:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get projects'
        }
      });
    }
  }
);

/**
 * GET /api/projects/:id
 * Get a specific project by ID
 */
router.get('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Project ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const projectId = req.params.id;

      const project = await projectService.getProjectById(userId, projectId);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found or not accessible'
          }
        });
      }

      res.json({
        success: true,
        data: {
          project
        }
      });
    } catch (error) {
      console.error('Error getting project:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get project'
        }
      });
    }
  }
);

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/',
  [
    body('name')
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Project name must be between 1 and 255 characters'),
    body('color')
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/)
      .withMessage('Color must be a valid hex color code (e.g., #3B82F6)'),
    body('description')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must be a string with max 1000 characters')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const request: CreateProjectRequest = {
        name: req.body.name,
        color: req.body.color,
        description: req.body.description
      };

      const project = await projectService.createProject(userId, request);

      res.status(201).json({
        success: true,
        data: {
          project,
          message: 'Project created successfully'
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Project with this name already exists') {
          return res.status(409).json({
            success: false,
            error: {
              code: 'PROJECT_NAME_EXISTS',
              message: 'Project with this name already exists'
            }
          });
        }

        if (error.message.includes('Color must be a valid hex color code')) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_COLOR',
              message: 'Color must be a valid hex color code (e.g., #3B82F6)'
            }
          });
        }
      }

      console.error('Error creating project:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create project'
        }
      });
    }
  }
);

/**
 * PUT /api/projects/:id
 * Update a project
 */
router.put('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Project ID must be a valid UUID'),
    body('name')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Project name must be between 1 and 255 characters'),
    body('color')
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/)
      .withMessage('Color must be a valid hex color code (e.g., #3B82F6)'),
    body('description')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must be a string with max 1000 characters'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const projectId = req.params.id;
      const request: UpdateProjectRequest = {
        name: req.body.name,
        color: req.body.color,
        description: req.body.description,
        isActive: req.body.isActive
      };

      const project = await projectService.updateProject(userId, projectId, request);

      res.json({
        success: true,
        data: {
          project,
          message: 'Project updated successfully'
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Project not found or not accessible') {
          return res.status(404).json({
            success: false,
            error: {
              code: 'PROJECT_NOT_FOUND',
              message: 'Project not found or not accessible'
            }
          });
        }

        if (error.message === 'Project with this name already exists') {
          return res.status(409).json({
            success: false,
            error: {
              code: 'PROJECT_NAME_EXISTS',
              message: 'Project with this name already exists'
            }
          });
        }

        if (error.message.includes('Color must be a valid hex color code')) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_COLOR',
              message: 'Color must be a valid hex color code (e.g., #3B82F6)'
            }
          });
        }
      }

      console.error('Error updating project:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update project'
        }
      });
    }
  }
);

/**
 * DELETE /api/projects/:id
 * Delete a project
 */
router.delete('/:id',
  [
    param('id')
      .isUUID()
      .withMessage('Project ID must be a valid UUID')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const projectId = req.params.id;

      await projectService.deleteProject(userId, projectId);

      res.json({
        success: true,
        data: {
          message: 'Project deleted successfully'
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Project not found or not accessible') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found or not accessible'
          }
        });
      }

      console.error('Error deleting project:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete project'
        }
      });
    }
  }
);

/**
 * GET /api/projects/colors/used
 * Get all colors currently in use by the user's projects
 */
router.get('/colors/used', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const colors = await projectService.getUsedColors(userId);

    res.json({
      success: true,
      data: {
        colors,
        count: colors.length
      }
    });
  } catch (error) {
    console.error('Error getting used colors:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get used colors'
      }
    });
  }
});

export default router;