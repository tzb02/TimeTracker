import { SessionManager, SessionData } from '../sessionManager';
import { createClient } from 'redis';

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  setEx: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  ttl: jest.fn(),
  on: jest.fn(),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  const mockSessionData: SessionData = {
    userId: '123e4567-e89b-12d3-a456-426614174001',
    email: 'test@example.com',
    role: 'user',
    loginTime: Date.now(),
    lastActivity: Date.now(),
    refreshTokenId: 'refresh-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sessionManager = new SessionManager();
  });

  describe('constructor', () => {
    it('should create Redis client with default URL', () => {
      expect(createClient).toHaveBeenCalledWith({
        url: 'redis://localhost:6379',
        socket: {
          reconnectStrategy: expect.any(Function),
        },
      });
    });

    it('should create Redis client with custom URL from environment', () => {
      const originalRedisUrl = process.env.REDIS_URL;
      process.env.REDIS_URL = 'redis://custom:6380';

      new SessionManager();

      expect(createClient).toHaveBeenCalledWith({
        url: 'redis://custom:6380',
        socket: {
          reconnectStrategy: expect.any(Function),
        },
      });

      // Restore original environment
      if (originalRedisUrl) {
        process.env.REDIS_URL = originalRedisUrl;
      } else {
        delete process.env.REDIS_URL;
      }
    });

    it('should set up event listeners', () => {
      expect(mockRedisClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });
  });

  describe('connect', () => {
    it('should connect to Redis', async () => {
      await sessionManager.connect();
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should not connect if already connected', async () => {
      // Simulate connected state
      sessionManager['isConnected'] = true;
      
      await sessionManager.connect();
      expect(mockRedisClient.connect).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Redis', async () => {
      sessionManager['isConnected'] = true;
      
      await sessionManager.disconnect();
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('should not disconnect if not connected', async () => {
      await sessionManager.disconnect();
      expect(mockRedisClient.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('createSession', () => {
    it('should create session with default TTL', async () => {
      const sessionId = 'session-123';
      
      await sessionManager.createSession(sessionId, mockSessionData);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'session:session-123',
        604800, // 7 days default
        JSON.stringify(mockSessionData)
      );
    });

    it('should create session with custom TTL', async () => {
      const sessionId = 'session-123';
      const customTtl = 3600; // 1 hour
      
      await sessionManager.createSession(sessionId, mockSessionData, customTtl);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'session:session-123',
        customTtl,
        JSON.stringify(mockSessionData)
      );
    });
  });

  describe('getSession', () => {
    it('should retrieve session data', async () => {
      const sessionId = 'session-123';
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSessionData));
      
      const result = await sessionManager.getSession(sessionId);
      
      expect(mockRedisClient.get).toHaveBeenCalledWith('session:session-123');
      expect(result).toEqual(mockSessionData);
    });

    it('should return null for non-existent session', async () => {
      const sessionId = 'session-123';
      mockRedisClient.get.mockResolvedValue(null);
      
      const result = await sessionManager.getSession(sessionId);
      
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON data', async () => {
      const sessionId = 'session-123';
      mockRedisClient.get.mockResolvedValue('invalid-json');
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await sessionManager.getSession(sessionId);
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error parsing session data:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('updateSession', () => {
    it('should update existing session', async () => {
      const sessionId = 'session-123';
      const updateData = { lastActivity: Date.now() + 1000 };
      
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSessionData));
      mockRedisClient.ttl.mockResolvedValue(3600);
      
      const result = await sessionManager.updateSession(sessionId, updateData);
      
      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'session:session-123',
        3600,
        JSON.stringify({ ...mockSessionData, ...updateData })
      );
    });

    it('should return false for non-existent session', async () => {
      const sessionId = 'session-123';
      mockRedisClient.get.mockResolvedValue(null);
      
      const result = await sessionManager.updateSession(sessionId, { lastActivity: Date.now() });
      
      expect(result).toBe(false);
      expect(mockRedisClient.setEx).not.toHaveBeenCalled();
    });

    it('should use default TTL when TTL is expired', async () => {
      const sessionId = 'session-123';
      const updateData = { lastActivity: Date.now() + 1000 };
      
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSessionData));
      mockRedisClient.ttl.mockResolvedValue(-1); // Expired
      
      await sessionManager.updateSession(sessionId, updateData);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'session:session-123',
        604800, // Default TTL
        JSON.stringify({ ...mockSessionData, ...updateData })
      );
    });
  });

  describe('deleteSession', () => {
    it('should delete existing session', async () => {
      const sessionId = 'session-123';
      mockRedisClient.del.mockResolvedValue(1);
      
      const result = await sessionManager.deleteSession(sessionId);
      
      expect(mockRedisClient.del).toHaveBeenCalledWith('session:session-123');
      expect(result).toBe(true);
    });

    it('should return false for non-existent session', async () => {
      const sessionId = 'session-123';
      mockRedisClient.del.mockResolvedValue(0);
      
      const result = await sessionManager.deleteSession(sessionId);
      
      expect(result).toBe(false);
    });
  });

  describe('storeRefreshToken', () => {
    it('should store refresh token with default TTL', async () => {
      const tokenId = 'token-123';
      const userId = 'user-123';
      
      await sessionManager.storeRefreshToken(tokenId, userId);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'refresh_token:token-123',
        604800, // 7 days default
        userId
      );
    });

    it('should store refresh token with custom TTL', async () => {
      const tokenId = 'token-123';
      const userId = 'user-123';
      const customTtl = 3600;
      
      await sessionManager.storeRefreshToken(tokenId, userId, customTtl);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'refresh_token:token-123',
        customTtl,
        userId
      );
    });
  });

  describe('getRefreshTokenUserId', () => {
    it('should retrieve user ID from refresh token', async () => {
      const tokenId = 'token-123';
      const userId = 'user-123';
      mockRedisClient.get.mockResolvedValue(userId);
      
      const result = await sessionManager.getRefreshTokenUserId(tokenId);
      
      expect(mockRedisClient.get).toHaveBeenCalledWith('refresh_token:token-123');
      expect(result).toBe(userId);
    });

    it('should return null for non-existent token', async () => {
      const tokenId = 'token-123';
      mockRedisClient.get.mockResolvedValue(null);
      
      const result = await sessionManager.getRefreshTokenUserId(tokenId);
      
      expect(result).toBeNull();
    });
  });

  describe('deleteRefreshToken', () => {
    it('should delete existing refresh token', async () => {
      const tokenId = 'token-123';
      mockRedisClient.del.mockResolvedValue(1);
      
      const result = await sessionManager.deleteRefreshToken(tokenId);
      
      expect(mockRedisClient.del).toHaveBeenCalledWith('refresh_token:token-123');
      expect(result).toBe(true);
    });

    it('should return false for non-existent token', async () => {
      const tokenId = 'token-123';
      mockRedisClient.del.mockResolvedValue(0);
      
      const result = await sessionManager.deleteRefreshToken(tokenId);
      
      expect(result).toBe(false);
    });
  });

  describe('deleteUserSessions', () => {
    it('should delete all sessions for a user', async () => {
      const userId = 'user-123';
      const sessionKeys = ['session:sess1', 'session:sess2', 'session:sess3'];
      
      mockRedisClient.keys.mockResolvedValue(sessionKeys);
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({ ...mockSessionData, userId }))
        .mockResolvedValueOnce(JSON.stringify({ ...mockSessionData, userId: 'other-user' }))
        .mockResolvedValueOnce(JSON.stringify({ ...mockSessionData, userId }));
      
      const result = await sessionManager.deleteUserSessions(userId);
      
      expect(mockRedisClient.keys).toHaveBeenCalledWith('session:*');
      expect(mockRedisClient.del).toHaveBeenCalledTimes(2); // Only sessions for the target user
      expect(result).toBe(2);
    });

    it('should handle invalid session data', async () => {
      const userId = 'user-123';
      const sessionKeys = ['session:sess1'];
      
      mockRedisClient.keys.mockResolvedValue(sessionKeys);
      mockRedisClient.get.mockResolvedValue('invalid-json');
      
      const result = await sessionManager.deleteUserSessions(userId);
      
      expect(mockRedisClient.del).toHaveBeenCalledWith('session:sess1'); // Invalid data should be deleted
      expect(result).toBe(1);
    });
  });

  describe('deleteUserRefreshTokens', () => {
    it('should delete all refresh tokens for a user', async () => {
      const userId = 'user-123';
      const tokenKeys = ['refresh_token:token1', 'refresh_token:token2', 'refresh_token:token3'];
      
      mockRedisClient.keys.mockResolvedValue(tokenKeys);
      mockRedisClient.get
        .mockResolvedValueOnce(userId)
        .mockResolvedValueOnce('other-user')
        .mockResolvedValueOnce(userId);
      
      const result = await sessionManager.deleteUserRefreshTokens(userId);
      
      expect(mockRedisClient.keys).toHaveBeenCalledWith('refresh_token:*');
      expect(mockRedisClient.del).toHaveBeenCalledTimes(2); // Only tokens for the target user
      expect(result).toBe(2);
    });
  });

  describe('updateActivity', () => {
    it('should update session activity timestamp', async () => {
      const sessionId = 'session-123';
      
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockSessionData));
      mockRedisClient.ttl.mockResolvedValue(3600);
      
      const result = await sessionManager.updateActivity(sessionId);
      
      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'session:session-123',
        3600,
        expect.stringContaining('"lastActivity":')
      );
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should clean up inactive sessions', async () => {
      const now = Date.now();
      const maxInactivity = 24 * 60 * 60 * 1000; // 24 hours
      
      const activeSession = { ...mockSessionData, lastActivity: now - 1000 }; // 1 second ago
      const expiredSession = { ...mockSessionData, lastActivity: now - maxInactivity - 1000 }; // Over 24 hours ago
      
      const sessionKeys = ['session:active', 'session:expired', 'session:invalid'];
      
      mockRedisClient.keys.mockResolvedValue(sessionKeys);
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify(activeSession))
        .mockResolvedValueOnce(JSON.stringify(expiredSession))
        .mockResolvedValueOnce('invalid-json');
      
      const result = await sessionManager.cleanupExpiredSessions();
      
      expect(mockRedisClient.del).toHaveBeenCalledWith('session:expired');
      expect(mockRedisClient.del).toHaveBeenCalledWith('session:invalid');
      expect(mockRedisClient.del).toHaveBeenCalledTimes(2);
      expect(result).toBe(2);
    });
  });

  describe('isRedisConnected', () => {
    it('should return connection status', () => {
      expect(sessionManager.isRedisConnected()).toBe(false);
      
      sessionManager['isConnected'] = true;
      expect(sessionManager.isRedisConnected()).toBe(true);
    });
  });
});