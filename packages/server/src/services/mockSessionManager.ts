import { SessionManager } from './sessionManager';

export class MockSessionManager implements SessionManager {
  private store: Map<string, { value: any; expires?: number }> = new Map();

  async connect(): Promise<void> {
    console.log('✅ Mock session manager connected');
  }

  async disconnect(): Promise<void> {
    this.store.clear();
    console.log('🔌 Mock session manager disconnected');
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const expires = ttl ? Date.now() + (ttl * 1000) : undefined;
    this.store.set(key, { value, expires });
  }

  async get(key: string): Promise<any> {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (item.expires && Date.now() > item.expires) {
      this.store.delete(key);
      return null;
    }
    
    return item.value;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const item = this.store.get(key);
    if (!item) return false;
    
    if (item.expires && Date.now() > item.expires) {
      this.store.delete(key);
      return false;
    }
    
    return true;
  }

  async createSession(sessionId: string, sessionData: any, ttl: number = 24 * 60 * 60): Promise<void> {
    await this.set(`session:${sessionId}`, sessionData, ttl);
  }

  async storeRefreshToken(userId: string, refreshToken: string, ttl: number = 7 * 24 * 60 * 60): Promise<void> {
    await this.set(`refresh:${userId}`, refreshToken, ttl);
  }
}