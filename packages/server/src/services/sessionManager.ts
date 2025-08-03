import Redis from 'ioredis';

export interface SessionManager {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  get(key: string): Promise<any>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
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
}

let sessionManager: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManager) {
    sessionManager = new RedisSessionManager();
  }
  return sessionManager;
}