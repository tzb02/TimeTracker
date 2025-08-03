import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { getAuthService } from '../services/authService';
import { authRateLimit } from '../middleware/auth';

const router = Router();
const authService = getAuthService();

// Apply rate limiting to auth endpoints
router.use(authRateLimit());

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  body('organizationId')
    .optional()
    .isUUID()
    .withMessage('Organization ID must be a valid UUID'),
], async (req: Request, res: Response) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    const { email, name, password, organizationId } = req.body;

    const result = await authService.register({
      email,
      name,
      password,
      organizationId,
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      sessionId: result.sessionId,
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        res.status(409).json({ error: error.message });
        return;
      }
      
      if (error.message.includes('validation failed')) {
        res.status(400).json({ error: error.message });
        return;
      }
    }

    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
], async (req: Request, res: Response) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    const { email, password } = req.body;

    const result = await authService.login(email, password);

    res.json({
      message: 'Login successful',
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      sessionId: result.sessionId,
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error instanceof Error && error.message.includes('Invalid email or password')) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required'),
], async (req: Request, res: Response) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    const { refreshToken } = req.body;

    const result = await authService.refreshToken(refreshToken);

    res.json({
      message: 'Token refreshed successfully',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    
    if (error instanceof Error && error.message.includes('Invalid or expired')) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers['x-session-id'] as string;
    const refreshTokenId = req.body.refreshTokenId;

    if (sessionId) {
      await authService.logout(sessionId, refreshTokenId);
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * POST /api/auth/logout-all
 * Logout user from all devices
 */
router.post('/logout-all', [
  body('userId')
    .isUUID()
    .withMessage('Valid user ID is required'),
], async (req: Request, res: Response) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    const { userId } = req.body;

    await authService.logoutAll(userId);

    res.json({ message: 'Logged out from all devices successfully' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ error: 'Logout from all devices failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (requires authentication)
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    // This endpoint would typically use the auth middleware
    // For now, we'll extract user info from the token manually
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const token = authHeader.substring(7);
    const { verifyAccessToken } = await import('../utils/auth');
    const decoded = verifyAccessToken(token);

    const user = await authService.getUserById(decoded.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Remove password hash from response
    const { passwordHash, ...userWithoutPassword } = user;

    res.json({
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Get user info error:', error);
    
    if (error instanceof Error && error.message.includes('Invalid or expired')) {
      res.status(401).json({ error: 'Invalid or expired access token' });
      return;
    }

    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * PUT /api/auth/password
 * Update user password (requires authentication)
 */
router.put('/password', [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long'),
], async (req: Request, res: Response) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    // Extract user ID from token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const token = authHeader.substring(7);
    const { verifyAccessToken } = await import('../utils/auth');
    const decoded = verifyAccessToken(token);

    const { currentPassword, newPassword } = req.body;

    await authService.updatePassword(decoded.userId, currentPassword, newPassword);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password update error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Current password is incorrect')) {
        res.status(400).json({ error: error.message });
        return;
      }
      
      if (error.message.includes('validation failed')) {
        res.status(400).json({ error: error.message });
        return;
      }
      
      if (error.message.includes('Invalid or expired')) {
        res.status(401).json({ error: 'Invalid or expired access token' });
        return;
      }
    }

    res.status(500).json({ error: 'Password update failed' });
  }
});

export default router;