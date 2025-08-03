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

  async storeRefreshToken(refreshTokenId: string, userId: string, ttl: number = 7 * 24 * 60 * 60): Promise<void> {
    await this.set(`refresh:${refreshTokenId}`, { userId, refreshTokenId }, ttl);
  }

  async getSession(sessionId: string): Promise<any> {
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
    const keysToDelete: string[] = [];
    for (const [key, item] of this.store.entries()) {
      if (key.startsWith('session:') && item.value && item.value.userId === userId) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      await this.delete(key);
    }
  }

  async deleteUserRefreshTokens(userId: string): Promise<void> {
    // Get all refresh token keys for this user
    const keysToDelete: string[] = [];
    for (const [key, item] of this.store.entries()) {
      if (key.startsWith('refresh:') && item.value && item.value.userId === userId) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      await this.delete(key);
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