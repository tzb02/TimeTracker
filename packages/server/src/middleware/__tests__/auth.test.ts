import { Request, Response, NextFunction } from 'express';
import {
  authenticateToken,
  requireAdmin,
  requireOwnershipOrAdmin,
  optionalAuth,
  authRateLimit,
} from '../auth';
import { AuthService } from '../../services/authService';

// Mock dependencies
jest.mock('../../services/authService');
jest.mock('../../utils/auth');

const mockAuthService = {
  validateSession: jest.fn(),
} as unknown as AuthService;

jest.mock('../../services/authService', () => ({
  getAuthService: () => mockAuthService,
}));

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request> & { ip?: string };
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      user: undefined,
      sessionId: undefined,
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    const mockDecodedToken = {
      userId: '123e4567-e89b-12d3-a456-426614174001',
      email: 'test@example.com',
      role: 'user',
    };

    beforeEach(() => {
      const { verifyAccessToken, extractTokenFromHeader } = require('../../utils/auth');
      extractTokenFromHeader.mockReturnValue('valid.jwt.token');
      verifyAccessToken.mockReturnValue(mockDecodedToken);
    });

    it('should authenticate valid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid.jwt.token',
      };

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(mockDecodedToken);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should authenticate with session validation', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid.jwt.token',
        'x-session-id': 'session-123',
      };

      const mockSessionData = {
        userId: mockDecodedToken.userId,
        email: mockDecodedToken.email,
        role: mockDecodedToken.role,
        loginTime: Date.now(),
        lastActivity: Date.now(),
        refreshTokenId: 'refresh-123',
      };

      (mockAuthService.validateSession as jest.Mock).mockResolvedValue(mockSessionData);

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(mockDecodedToken);
      expect(mockRequest.sessionId).toBe('session-123');
      expect(mockNext).toHaveBeenCalled();
      expect(mockAuthService.validateSession).toHaveBeenCalledWith('session-123');
    });

    it('should reject request without token', async () => {
      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Access token required',
        code: 'TOKEN_MISSING',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.token',
      };

      const { verifyAccessToken } = require('../../utils/auth');
      verifyAccessToken.mockImplementation(() => {
        throw new Error('Invalid or expired access token');
      });

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid token',
        code: 'TOKEN_INVALID',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject expired token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer expired.token',
      };

      const { verifyAccessToken } = require('../../utils/auth');
      verifyAccessToken.mockImplementation(() => {
        throw new Error('Token expired');
      });

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid session', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid.jwt.token',
        'x-session-id': 'invalid-session',
      };

      (mockAuthService.validateSession as jest.Mock).mockResolvedValue(null);

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid session',
        code: 'INVALID_SESSION',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject session with mismatched user ID', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid.jwt.token',
        'x-session-id': 'session-123',
      };

      const mockSessionData = {
        userId: 'different-user-id',
        email: 'other@example.com',
        role: 'user',
        loginTime: Date.now(),
        lastActivity: Date.now(),
        refreshTokenId: 'refresh-123',
      };

      (mockAuthService.validateSession as jest.Mock).mockResolvedValue(mockSessionData);

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid session',
        code: 'INVALID_SESSION',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should allow admin user', () => {
      mockRequest.user = {
        userId: '123e4567-e89b-12d3-a456-426614174001',
        email: 'admin@example.com',
        role: 'admin',
      };

      requireAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject non-admin user', () => {
      mockRequest.user = {
        userId: '123e4567-e89b-12d3-a456-426614174001',
        email: 'user@example.com',
        role: 'user',
      };

      requireAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated request', () => {
      requireAdmin(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireOwnershipOrAdmin', () => {
    const middleware = requireOwnershipOrAdmin('userId');

    it('should allow admin to access any resource', () => {
      mockRequest.user = {
        userId: '123e4567-e89b-12d3-a456-426614174001',
        email: 'admin@example.com',
        role: 'admin',
      };
      mockRequest.params = { userId: 'different-user-id' };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow user to access their own resource', () => {
      const userId = '123e4567-e89b-12d3-a456-426614174001';
      mockRequest.user = {
        userId,
        email: 'user@example.com',
        role: 'user',
      };
      mockRequest.params = { userId };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject user accessing other user resource', () => {
      mockRequest.user = {
        userId: '123e4567-e89b-12d3-a456-426614174001',
        email: 'user@example.com',
        role: 'user',
      };
      mockRequest.params = { userId: 'different-user-id' };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Access denied',
        code: 'ACCESS_DENIED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated request', () => {
      mockRequest.params = { userId: 'some-user-id' };

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    const mockDecodedToken = {
      userId: '123e4567-e89b-12d3-a456-426614174001',
      email: 'test@example.com',
      role: 'user',
    };

    it('should authenticate valid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid.jwt.token',
      };

      const { verifyAccessToken } = require('../../utils/auth');
      verifyAccessToken.mockReturnValue(mockDecodedToken);

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(mockDecodedToken);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should proceed without authentication when no token provided', async () => {
      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should proceed without authentication when token is invalid', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.token',
      };

      const { verifyAccessToken } = require('../../utils/auth');
      verifyAccessToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should clear user info for invalid session', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid.jwt.token',
        'x-session-id': 'invalid-session',
      };

      const { verifyAccessToken } = require('../../utils/auth');
      verifyAccessToken.mockReturnValue(mockDecodedToken);
      (mockAuthService.validateSession as jest.Mock).mockResolvedValue(null);

      await optionalAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockRequest.sessionId).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('authRateLimit', () => {
    let rateLimitMiddleware: ReturnType<typeof authRateLimit>;

    beforeEach(() => {
      rateLimitMiddleware = authRateLimit(3, 60000); // 3 attempts per minute
      mockRequest.ip = '127.0.0.1';
    });

    it('should allow requests within limit', () => {
      rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(3);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding limit', () => {
      // Make 3 requests (at the limit)
      rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // 4th request should be blocked
      rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(3);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Too many authentication attempts',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: expect.any(Number),
      });
    });

    it('should handle different IP addresses separately', () => {
      const mockRequest2 = { ...mockRequest, ip: '192.168.1.1' };

      // Make 3 requests from first IP
      rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      rateLimitMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Request from second IP should still be allowed
      rateLimitMiddleware(mockRequest2 as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(4);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });
});