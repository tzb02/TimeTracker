import { AuthService } from '../authService';
import { SessionManager } from '../sessionManager';
import { Database } from '../../database';

// Mock dependencies
jest.mock('../sessionManager');
jest.mock('../../database');

const mockDatabase = {
  query: jest.fn(),
} as unknown as DatabaseConnection;

const mockSessionManager = {
  createSession: jest.fn(),
  storeRefreshToken: jest.fn(),
  deleteSession: jest.fn(),
  deleteRefreshToken: jest.fn(),
  deleteUserSessions: jest.fn(),
  deleteUserRefreshTokens: jest.fn(),
  getSession: jest.fn(),
  updateActivity: jest.fn(),
  getRefreshTokenUserId: jest.fn(),
} as unknown as SessionManager;

// Mock the getDatabase and getSessionManager functions
jest.mock('../../database', () => ({
  getDatabase: () => mockDatabase,
}));

jest.mock('../sessionManager', () => ({
  getSessionManager: () => mockSessionManager,
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService();
  });

  describe('register', () => {
    const validUserData = {
      email: 'test@example.com',
      name: 'Test User',
      password: 'StrongPass123!',
      organizationId: '123e4567-e89b-12d3-a456-426614174000',
    };

    const mockUserRow = {
      id: '123e4567-e89b-12d3-a456-426614174001',
      email: 'test@example.com',
      name: 'Test User',
      organization_id: '123e4567-e89b-12d3-a456-426614174000',
      role: 'user',
      preferences: {
        timeFormat: '24h',
        weekStartDay: 1,
        notifications: true,
      },
      created_at: new Date(),
      updated_at: new Date(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      // Mock getUserByEmail to return null (user doesn't exist)
      (mockDatabase.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // getUserByEmail
        .mockResolvedValueOnce({ rows: [mockUserRow] }); // insert user
    });

    it('should register user successfully', async () => {
      const result = await authService.register(validUserData);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('sessionId');

      expect(result.user.email).toBe(validUserData.email);
      expect(result.user.name).toBe(validUserData.name);
      expect(result.user.passwordHash).toBeUndefined();

      expect(mockSessionManager.createSession).toHaveBeenCalled();
      expect(mockSessionManager.storeRefreshToken).toHaveBeenCalled();
    });

    it('should throw error for invalid email', async () => {
      const invalidData = { ...validUserData, email: 'invalid-email' };

      await expect(authService.register(invalidData)).rejects.toThrow('Invalid email format');
    });

    it('should throw error for weak password', async () => {
      const invalidData = { ...validUserData, password: 'weak' };

      await expect(authService.register(invalidData)).rejects.toThrow('Password validation failed');
    });

    it('should throw error for short name', async () => {
      const invalidData = { ...validUserData, name: 'A' };

      await expect(authService.register(invalidData)).rejects.toThrow('Name must be at least 2 characters long');
    });

    it('should throw error if user already exists', async () => {
      // Mock getUserByEmail to return existing user
      (mockDatabase.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'existing-user-id', email: validUserData.email }],
      });

      await expect(authService.register(validUserData)).rejects.toThrow('User with this email already exists');
    });
  });

  describe('login', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'StrongPass123!',
    };

    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174001',
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: '$2b$12$hashedpassword',
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

    beforeEach(() => {
      // Mock getUserByEmail to return user
      (mockDatabase.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          password_hash: mockUser.passwordHash,
          organization_id: mockUser.organizationId,
          role: mockUser.role,
          preferences: mockUser.preferences,
          created_at: mockUser.createdAt,
          updated_at: mockUser.updatedAt,
        }],
      });
    });

    it('should login user successfully with correct credentials', async () => {
      // Mock password verification to return true
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const result = await authService.login(loginData.email, loginData.password);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('sessionId');

      expect(result.user.email).toBe(loginData.email);
      expect(result.user.passwordHash).toBeUndefined();

      expect(mockSessionManager.createSession).toHaveBeenCalled();
      expect(mockSessionManager.storeRefreshToken).toHaveBeenCalled();
    });

    it('should throw error for invalid email format', async () => {
      await expect(authService.login('invalid-email', loginData.password))
        .rejects.toThrow('Invalid email format');
    });

    it('should throw error for non-existent user', async () => {
      // Mock getUserByEmail to return null
      (mockDatabase.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(authService.login(loginData.email, loginData.password))
        .rejects.toThrow('Invalid email or password');
    });

    it('should throw error for incorrect password', async () => {
      // Mock password verification to return false
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await expect(authService.login(loginData.email, loginData.password))
        .rejects.toThrow('Invalid email or password');
    });

    it('should throw error for missing credentials', async () => {
      await expect(authService.login('', loginData.password))
        .rejects.toThrow('Email and password are required');

      await expect(authService.login(loginData.email, ''))
        .rejects.toThrow('Email and password are required');
    });
  });

  describe('refreshToken', () => {
    const mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174001',
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: '$2b$12$hashedpassword',
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

    beforeEach(() => {
      // Mock getUserById to return user
      (mockDatabase.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          password_hash: mockUser.passwordHash,
          organization_id: mockUser.organizationId,
          role: mockUser.role,
          preferences: mockUser.preferences,
          created_at: mockUser.createdAt,
          updated_at: mockUser.updatedAt,
        }],
      });
    });

    it('should refresh token successfully', async () => {
      // Create a valid refresh token
      const { generateRefreshToken } = await import('../../utils/auth');
      const refreshToken = generateRefreshToken(mockUser.id);

      const result = await authService.refreshToken(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(authService.refreshToken('invalid.token.here'))
        .rejects.toThrow('Invalid or expired refresh token');
    });

    it('should throw error if user not found', async () => {
      // Mock getUserById to return null
      (mockDatabase.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const { generateRefreshToken } = await import('../../utils/auth');
      const refreshToken = generateRefreshToken(mockUser.id);

      await expect(authService.refreshToken(refreshToken))
        .rejects.toThrow('Invalid or expired refresh token');
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const sessionId = 'session-123';
      const refreshTokenId = 'refresh-123';

      await authService.logout(sessionId, refreshTokenId);

      expect(mockSessionManager.deleteSession).toHaveBeenCalledWith(sessionId);
      expect(mockSessionManager.deleteRefreshToken).toHaveBeenCalledWith(refreshTokenId);
    });

    it('should logout without refresh token', async () => {
      const sessionId = 'session-123';

      await authService.logout(sessionId);

      expect(mockSessionManager.deleteSession).toHaveBeenCalledWith(sessionId);
      expect(mockSessionManager.deleteRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('logoutAll', () => {
    it('should logout user from all devices', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174001';

      await authService.logoutAll(userId);

      expect(mockSessionManager.deleteUserSessions).toHaveBeenCalledWith(userId);
      expect(mockSessionManager.deleteUserRefreshTokens).toHaveBeenCalledWith(userId);
    });
  });

  describe('updatePassword', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174001';
    const currentPassword = 'OldPass123!';
    const newPassword = 'NewPass123!';

    const mockUser = {
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: '$2b$12$hashedpassword',
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

    beforeEach(() => {
      // Mock getUserById to return user
      (mockDatabase.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            id: mockUser.id,
            email: mockUser.email,
            name: mockUser.name,
            password_hash: mockUser.passwordHash,
            organization_id: mockUser.organizationId,
            role: mockUser.role,
            preferences: mockUser.preferences,
            created_at: mockUser.createdAt,
            updated_at: mockUser.updatedAt,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // update password query
    });

    it('should update password successfully', async () => {
      // Mock password verification to return true for current password
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('$2b$12$newhashedpassword');

      await authService.updatePassword(userId, currentPassword, newPassword);

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining(['$2b$12$newhashedpassword'])
      );
      expect(mockSessionManager.deleteUserSessions).toHaveBeenCalledWith(userId);
      expect(mockSessionManager.deleteUserRefreshTokens).toHaveBeenCalledWith(userId);
    });

    it('should throw error for incorrect current password', async () => {
      // Mock password verification to return false
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await expect(authService.updatePassword(userId, currentPassword, newPassword))
        .rejects.toThrow('Current password is incorrect');
    });

    it('should throw error for weak new password', async () => {
      // Mock password verification to return true for current password
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      await expect(authService.updatePassword(userId, currentPassword, 'weak'))
        .rejects.toThrow('Password validation failed');
    });

    it('should throw error if user not found', async () => {
      // Mock getUserById to return null
      (mockDatabase.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(authService.updatePassword(userId, currentPassword, newPassword))
        .rejects.toThrow('User not found');
    });
  });

  describe('validateSession', () => {
    const sessionId = 'session-123';
    const mockSessionData = {
      userId: '123e4567-e89b-12d3-a456-426614174001',
      email: 'test@example.com',
      role: 'user',
      loginTime: Date.now(),
      lastActivity: Date.now(),
      refreshTokenId: 'refresh-123',
    };

    it('should validate session successfully', async () => {
      (mockSessionManager.getSession as jest.Mock).mockResolvedValue(mockSessionData);

      const result = await authService.validateSession(sessionId);

      expect(result).toEqual(mockSessionData);
      expect(mockSessionManager.getSession).toHaveBeenCalledWith(sessionId);
      expect(mockSessionManager.updateActivity).toHaveBeenCalledWith(sessionId);
    });

    it('should return null for invalid session', async () => {
      (mockSessionManager.getSession as jest.Mock).mockResolvedValue(null);

      const result = await authService.validateSession(sessionId);

      expect(result).toBeNull();
      expect(mockSessionManager.updateActivity).not.toHaveBeenCalled();
    });
  });
});