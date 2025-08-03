import Redis from 'ioredis';

export interface SessionData {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
  loginTime: Date;
  lastActivity: Date;
  refreshTokenId?: string;
}

export interface SessionManager {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  get(key: string): Promise<any>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  createSession(sessionId: string, sessionData: SessionData, ttl?: number): Promise<void>;
  storeRefreshToken(refreshTokenId: string, userId: string, ttl?: number): Promise<void>;
  getSession(sessionId: string): Promise<SessionData | null>;
  deleteSession(sessionId: string): Promise<void>;
  deleteRefreshToken(refreshTokenId: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;
  deleteUserRefreshTokens(userId: string): Promise<void>;
  updateActivity(sessionId: string): Promise<void>;
}

class RedisSessionManager implements SessionManager {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true, // Don't connect automatically
      maxRetriesPerRequest: 1, // Reduce retry attempts
      enableOfflineQueue: false, // Don't queue commands when offline
    });

    // Handle connection errors gracefully
    this.client.on('error', (error) => {
      console.warn('Redis connection error (will fallback to mock):', error.message);
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.ping();
      console.log('✅ Redis connected successfully');
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
    console.log('🔌 Redis disconnected');
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async get(key: string): Promise<any> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async createSession(sessionId: string, sessionData: SessionData, ttl: number = 24 * 60 * 60): Promise<void> {
    await this.set(`session:${sessionId}`, sessionData, ttl);
  }

  async storeRefreshToken(refreshTokenId: string, userId: string, ttl: number = 7 * 24 * 60 * 60): Promise<void> {
    await this.set(`refresh:${refreshTokenId}`, { userId, refreshTokenId }, ttl);
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    return await this.get(`session:${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.delete(`session:${sessionId}`);
  }

  async deleteRefreshToken(refreshTokenId: string): Promise<void> {
    await this.delete(`refresh:${refreshTokenId}`);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    // Get all session keys for this user
    const keys = await this.client.keys(`session:*`);
    for (const key of keys) {
      const sessionData = await this.get(key);
      if (sessionData && sessionData.userId === userId) {
        await this.delete(key);
      }
    }
  }

  async deleteUserRefreshTokens(userId: string): Promise<void> {
    // Get all refresh token keys for this user
    const keys = await this.client.keys(`refresh:*`);
    for (const key of keys) {
      const tokenData = await this.get(key);
      if (tokenData && tokenData.userId === userId) {
        await this.delete(key);
      }
    }
  }

  async updateActivity(sessionId: string): Promise<void> {
    const sessionData = await this.getSession(sessionId);
    if (sessionData) {
      sessionData.lastActivity = new Date();
      await this.set(`session:${sessionId}`, sessionData, 24 * 60 * 60); // Reset TTL
    }
  }
}

let sessionManager: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManager) {
    sessionManager = new RedisSessionManager();
  }
  return sessionManager;
}