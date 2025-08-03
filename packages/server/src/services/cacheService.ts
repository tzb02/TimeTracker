import NodeCache from 'node-cache';

export class CacheService {
  private cache: NodeCache;
  private statsInterval?: NodeJS.Timeout;

  constructor() {
    // Initialize cache with default TTL of 10 minutes and check period of 2 minutes
    this.cache = new NodeCache({
      stdTTL: 600, // 10 minutes default
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false // Don't clone objects for better performance
    });

    // Only start stats logging in production
    if (process.env.NODE_ENV === 'production') {
      this.statsInterval = setInterval(() => {
        const stats = this.cache.getStats();
        if (stats.keys > 0) {
          console.log('Cache stats:', {
            keys: stats.keys,
            hits: stats.hits,
            misses: stats.misses,
            hitRate: stats.hits / (stats.hits + stats.misses)
          });
        }
      }, 300000); // Every 5 minutes
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = this.cache.get<T>(key);
      return value || null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    try {
      if (ttlSeconds !== undefined) {
        return this.cache.set(key, value, ttlSeconds);
      } else {
        return this.cache.set(key, value);
      }
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<boolean> {
    try {
      return this.cache.del(key) > 0;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple values from cache
   */
  async delMultiple(keys: string[]): Promise<number> {
    try {
      return this.cache.del(keys);
    } catch (error) {
      console.error('Cache delete multiple error:', error);
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  async flush(): Promise<void> {
    try {
      this.cache.flushAll();
    } catch (error) {
      console.error('Cache flush error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Get all cache keys
   */
  getKeys(): string[] {
    return this.cache.keys();
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get TTL for a key
   */
  getTtl(key: string): number | undefined {
    return this.cache.getTtl(key);
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = this.cache.keys();
      const matchingKeys = keys.filter(key => key.includes(pattern));
      return this.cache.del(matchingKeys);
    } catch (error) {
      console.error('Cache invalidate pattern error:', error);
      return 0;
    }
  }

  /**
   * Invalidate user-specific cache entries
   */
  async invalidateUserCache(userId: string): Promise<number> {
    return this.invalidatePattern(userId);
  }

  /**
   * Get or set with callback (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // If not in cache, execute callback
      const value = await callback();
      
      // Store in cache
      await this.set(key, value, ttlSeconds);
      
      return value;
    } catch (error) {
      console.error('Cache getOrSet error:', error);
      // If cache fails, still return the computed value
      return callback();
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = undefined;
    }
    this.cache.close();
  }
}