import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../auth';
import { AuthService } from '../../services/authService';

// Mock dependencies
jest.mock('../../services/authService');
jest.mock('../../middleware/auth');

jest.mock('../../services/authService', () => ({
  getAuthService: () => ({
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
    getUserById: jest.fn(),
    updatePassword: jest.fn(),
    validateSession: jest.fn(),
  }),
}));

const mockAuthService = require('../../services/authService').getAuthService();

// Mock middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = {
      userId: '123e4567-e89b-12d3-a456-426614174001',
      email: 'test@example.com',
      role: 'user',
    };
    req.sessionId = 'session-123';
    next();
  }),
  authRateLimit: jest.fn((maxAttempts: number, windowMs: number) => (req: any, res: any, next: any) => next()),
}));

const { authenticateToken: mockAuthenticateToken } = require('../../middleware/auth');

describe('Auth Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', authRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      name: 'Test User',
      password: 'StrongPass123!',
      organizationId: '123e4567-e89b-12d3-a456-426614174000',
    };

    const mockRegisterResult = {
      user: {
        id: '123e4567-e89b-12d3-a456-426614174001',
        email: 'test@example.com',
        name: 'Test User',
        organizationId: '123e4567-e89b-12d3-a456-426614174000',
        role: 'user',
        preferences: {
          timeFormat: '24h',
          weekStartDay: 1,
          notifications: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      accessToken: 'access.token.here',
      refreshToken: 'refresh.token.here',
      sessionId: 'session-123',
    };

    it('should register user successfully', async () => {
      (mockAuthService.register as jest.Mock).mockResolvedValue(mockRegisterResult);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: 'User registered successfully',
        user: mockRegisterResult.user,
        sessionId: mockRegisterResult.sessionId,
      });

      expect(mockAuthService.register).toHaveBeenCalledWith(validRegistrationData);
    });

    it('should set httpOnly cookies', async () => {
      (mockAuthService.register as jest.Mock).mockResolvedValue(mockRegisterResult);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData);

      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining('accessToken='),
          expect.stringContaining('refreshToken='),
          expect.stringContaining('HttpOnly'),
        ])
      );
    });

    it('should return validation errors for invalid input', async () => {
      const invalidData = {
        email: 'invalid-email',
        name: 'A',
        password: 'weak',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should handle user already exists error', async () => {
      (mockAuthService.register as jest.Mock).mockRejectedValue(
        new Error('User with this email already exists')
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: 'User with this email already exists',
        code: 'USER_EXISTS',
      });
    });

    it('should handle password validation errors', async () => {
      (mockAuthService.register as jest.Mock).mockRejectedValue(
        new Error('Password validation failed: Password too weak')
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Password validation failed: Password too weak',
        code: 'VALIDATION_ERROR',
      });
    });

    it('should handle general registration errors', async () => {
      (mockAuthService.register as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR',
      });
    });
  });

  describe('POST /api/auth/login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'StrongPass123!',
    };

    const mockLoginResult = {
      user: {
        id: '123e4567-e89b-12d3-a456-426614174001',
        email: 'test@example.com',
        name: 'Test User',
        organizationId: null,
        role: 'user',
        preferences: {
          timeFormat: '24h',
          weekStartDay: 1,
          notifications: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      accessToken: 'access.token.here',
      refreshToken: 'refresh.token.here',
      sessionId: 'session-123',
    };

    it('should login user successfully', async () => {
      (mockAuthService.login as jest.Mock).mockResolvedValue(mockLoginResult);

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Login successful',
        user: mockLoginResult.user,
        sessionId: mockLoginResult.sessionId,
      });

      expect(mockAuthService.login).toHaveBeenCalledWith(
        validLoginData.email,
        validLoginData.password
      );
    });

    it('should set httpOnly cookies on login', async () => {
      (mockAuthService.login as jest.Mock).mockResolvedValue(mockLoginResult);

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData);

      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining('accessToken='),
          expect.stringContaining('refreshToken='),
          expect.stringContaining('HttpOnly'),
        ])
      );
    });

    it('should return validation errors for invalid input', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: '',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle invalid credentials', async () => {
      (mockAuthService.login as jest.Mock).mockRejectedValue(
        new Error('Invalid email or password')
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('should handle general login errors', async () => {
      (mockAuthService.login as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Login failed',
        code: 'LOGIN_ERROR',
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    const mockRefreshResult = {
      accessToken: 'new.access.token',
      refreshToken: 'new.refresh.token',
    };

    it('should refresh token from request body', async () => {
      (mockAuthService.refreshToken as jest.Mock).mockResolvedValue(mockRefreshResult);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'old.refresh.token' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Token refreshed successfully',
        accessToken: mockRefreshResult.accessToken,
      });

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('old.refresh.token');
    });

    it('should refresh token from cookie', async () => {
      (mockAuthService.refreshToken as jest.Mock).mockResolvedValue(mockRefreshResult);

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=cookie.refresh.token')
        .send({});

      expect(response.status).toBe(200);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('cookie.refresh.token');
    });

    it('should return error when no refresh token provided', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Refresh token required',
        code: 'REFRESH_TOKEN_MISSING',
      });
    });

    it('should handle invalid refresh token', async () => {
      (mockAuthService.refreshToken as jest.Mock).mockRejectedValue(
        new Error('Invalid or expired refresh token')
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid.token' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', 'refreshToken=refresh.token.here');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Logout successful',
      });

      expect(mockAuthService.logout).toHaveBeenCalledWith('session-123');
    });

    it('should clear cookies on logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining('accessToken=;'),
          expect.stringContaining('refreshToken=;'),
        ])
      );
    });

    it('should clear cookies even on logout error', async () => {
      (mockAuthService.logout as jest.Mock).mockRejectedValue(
        new Error('Logout failed')
      );

      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(500);
      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining('accessToken=;'),
          expect.stringContaining('refreshToken=;'),
        ])
      );
    });
  });

  describe('POST /api/auth/logout-all', () => {
    it('should logout user from all devices', async () => {
      const response = await request(app)
        .post('/api/auth/logout-all');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Logged out from all devices successfully',
      });

      expect(mockAuthService.logoutAll).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174001'
      );
    });

    it('should handle logout all errors', async () => {
      (mockAuthService.logoutAll as jest.Mock).mockRejectedValue(
        new Error('Logout all failed')
      );

      const response = await request(app)
        .post('/api/auth/logout-all');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Logout from all devices failed',
        code: 'LOGOUT_ALL_ERROR',
      });
    });
  });

  describe('GET /api/auth/me', () => {
    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174001',
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: 'hashed-password',
      organizationId: null,
      role: 'user' as const,
      preferences: {
        timeFormat: '24h' as const,
        weekStartDay: 1,
        notifications: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return current user information', async () => {
      (mockAuthService.getUserById as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(200);
      expect(response.body.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        organizationId: mockUser.organizationId,
        role: mockUser.role,
        preferences: mockUser.preferences,
        createdAt: mockUser.createdAt.toISOString(),
        updatedAt: mockUser.updatedAt.toISOString(),
      });
      expect(response.body.user.passwordHash).toBeUndefined();
    });

    it('should handle user not found', async () => {
      (mockAuthService.getUserById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    });
  });

  describe('PUT /api/auth/change-password', () => {
    const validPasswordData = {
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass123!',
    };

    it('should change password successfully', async () => {
      const response = await request(app)
        .put('/api/auth/change-password')
        .send(validPasswordData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Password changed successfully. Please log in again.',
      });

      expect(mockAuthService.updatePassword).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174001',
        validPasswordData.currentPassword,
        validPasswordData.newPassword
      );
    });

    it('should clear cookies after password change', async () => {
      const response = await request(app)
        .put('/api/auth/change-password')
        .send(validPasswordData);

      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining('accessToken=;'),
          expect.stringContaining('refreshToken=;'),
        ])
      );
    });

    it('should return validation errors', async () => {
      const invalidData = {
        currentPassword: '',
        newPassword: 'weak',
      };

      const response = await request(app)
        .put('/api/auth/change-password')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle incorrect current password', async () => {
      (mockAuthService.updatePassword as jest.Mock).mockRejectedValue(
        new Error('Current password is incorrect')
      );

      const response = await request(app)
        .put('/api/auth/change-password')
        .send(validPasswordData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD',
      });
    });

    it('should handle password validation errors', async () => {
      (mockAuthService.updatePassword as jest.Mock).mockRejectedValue(
        new Error('Password validation failed: Too weak')
      );

      const response = await request(app)
        .put('/api/auth/change-password')
        .send(validPasswordData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Password validation failed: Too weak',
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('GET /api/auth/validate-session', () => {
    const mockSessionData = {
      userId: '123e4567-e89b-12d3-a456-426614174001',
      email: 'test@example.com',
      role: 'user',
      loginTime: Date.now(),
      lastActivity: Date.now(),
      refreshTokenId: 'refresh-123',
    };

    it('should validate session successfully', async () => {
      (mockAuthService.validateSession as jest.Mock).mockResolvedValue(mockSessionData);

      const response = await request(app)
        .get('/api/auth/validate-session');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Session is valid',
        session: {
          userId: mockSessionData.userId,
          email: mockSessionData.email,
          role: mockSessionData.role,
          loginTime: mockSessionData.loginTime,
          lastActivity: mockSessionData.lastActivity,
        },
      });

      expect(mockAuthService.validateSession).toHaveBeenCalledWith('session-123');
    });

    it('should handle invalid session', async () => {
      (mockAuthService.validateSession as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/auth/validate-session');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Session not found or expired',
        code: 'SESSION_EXPIRED',
      });
    });

    it('should handle missing session ID', async () => {
      mockAuthenticateToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.user = {
          userId: '123e4567-e89b-12d3-a456-426614174001',
          email: 'test@example.com',
          role: 'user',
        };
        // Don't set sessionId
        next();
      });

      const response = await request(app)
        .get('/api/auth/validate-session');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Invalid session',
        code: 'INVALID_SESSION',
      });
    });
  });
});