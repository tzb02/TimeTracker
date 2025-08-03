import { CacheService } from '../cacheService';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService();
  });

  afterEach(async () => {
    await cacheService.flush();
    cacheService.destroy();
  });

  describe('basic operations', () => {
    it('should set and get values', async () => {
      const key = 'test-key';
      const value = { data: 'test-data', number: 42 };

      const setResult = await cacheService.set(key, value);
      expect(setResult).toBe(true);

      const retrievedValue = await cacheService.get(key);
      expect(retrievedValue).toEqual(value);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cacheService.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should delete values', async () => {
      const key = 'test-key';
      const value = 'test-value';

      await cacheService.set(key, value);
      expect(await cacheService.get(key)).toBe(value);

      const deleteResult = await cacheService.del(key);
      expect(deleteResult).toBe(true);

      expect(await cacheService.get(key)).toBeNull();
    });

    it('should handle TTL correctly', async () => {
      const key = 'ttl-test';
      const value = 'expires-soon';
      const ttl = 1; // 1 second

      await cacheService.set(key, value, ttl);
      expect(await cacheService.get(key)).toBe(value);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(await cacheService.get(key)).toBeNull();
    });
  });

  describe('advanced operations', () => {
    it('should delete multiple keys', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = ['value1', 'value2', 'value3'];

      // Set multiple values
      for (let i = 0; i < keys.length; i++) {
        await cacheService.set(keys[i], values[i]);
      }

      // Verify they exist
      for (let i = 0; i < keys.length; i++) {
        expect(await cacheService.get(keys[i])).toBe(values[i]);
      }

      // Delete multiple
      const deleteCount = await cacheService.delMultiple(keys);
      expect(deleteCount).toBe(3);

      // Verify they're gone
      for (const key of keys) {
        expect(await cacheService.get(key)).toBeNull();
      }
    });

    it('should check if key exists', async () => {
      const key = 'exists-test';
      const value = 'test-value';

      expect(cacheService.has(key)).toBe(false);

      await cacheService.set(key, value);
      expect(cacheService.has(key)).toBe(true);

      await cacheService.del(key);
      expect(cacheService.has(key)).toBe(false);
    });

    it('should get cache keys', async () => {
      const keys = ['key1', 'key2', 'key3'];
      
      // Initially empty
      expect(cacheService.getKeys()).toEqual([]);

      // Set values
      for (const key of keys) {
        await cacheService.set(key, `value-${key}`);
      }

      const cacheKeys = cacheService.getKeys();
      expect(cacheKeys.sort()).toEqual(keys.sort());
    });

    it('should flush all cache entries', async () => {
      const keys = ['key1', 'key2', 'key3'];
      
      // Set values
      for (const key of keys) {
        await cacheService.set(key, `value-${key}`);
      }

      expect(cacheService.getKeys().length).toBe(3);

      await cacheService.flush();
      expect(cacheService.getKeys().length).toBe(0);
    });
  });

  describe('pattern operations', () => {
    it('should invalidate cache entries by pattern', async () => {
      const userKeys = ['user:123:profile', 'user:123:settings', 'user:456:profile'];
      const otherKeys = ['project:789', 'timer:active'];

      // Set all values
      for (const key of [...userKeys, ...otherKeys]) {
        await cacheService.set(key, `value-${key}`);
      }

      expect(cacheService.getKeys().length).toBe(5);

      // Invalidate user:123 entries
      const invalidatedCount = await cacheService.invalidatePattern('user:123');
      expect(invalidatedCount).toBe(2);

      // Check remaining keys
      const remainingKeys = cacheService.getKeys();
      expect(remainingKeys).toContain('user:456:profile');
      expect(remainingKeys).toContain('project:789');
      expect(remainingKeys).toContain('timer:active');
      expect(remainingKeys).not.toContain('user:123:profile');
      expect(remainingKeys).not.toContain('user:123:settings');
    });

    it('should invalidate user-specific cache entries', async () => {
      const userId = 'user-123';
      const userKeys = [`report:${userId}:weekly`, `dashboard:${userId}`, `timer:${userId}:active`];
      const otherKeys = ['report:user-456:weekly', 'global:config'];

      // Set all values
      for (const key of [...userKeys, ...otherKeys]) {
        await cacheService.set(key, `value-${key}`);
      }

      expect(cacheService.getKeys().length).toBe(5);

      // Invalidate user-specific entries
      const invalidatedCount = await cacheService.invalidateUserCache(userId);
      expect(invalidatedCount).toBe(3);

      // Check remaining keys
      const remainingKeys = cacheService.getKeys();
      expect(remainingKeys).toContain('report:user-456:weekly');
      expect(remainingKeys).toContain('global:config');
      expect(remainingKeys.length).toBe(2);
    });
  });

  describe('getOrSet pattern', () => {
    it('should return cached value if exists', async () => {
      const key = 'cached-key';
      const cachedValue = 'cached-data';
      const callbackValue = 'callback-data';

      // Set initial value
      await cacheService.set(key, cachedValue);

      // Mock callback that should not be called
      const callback = jest.fn().mockResolvedValue(callbackValue);

      const result = await cacheService.getOrSet(key, callback);

      expect(result).toBe(cachedValue);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should execute callback and cache result if not exists', async () => {
      const key = 'new-key';
      const callbackValue = 'callback-data';

      // Mock callback
      const callback = jest.fn().mockResolvedValue(callbackValue);

      const result = await cacheService.getOrSet(key, callback, 60);

      expect(result).toBe(callbackValue);
      expect(callback).toHaveBeenCalledTimes(1);

      // Verify it was cached
      const cachedResult = await cacheService.get(key);
      expect(cachedResult).toBe(callbackValue);
    });

    it('should handle callback errors gracefully', async () => {
      const key = 'error-key';
      const error = new Error('Callback failed');

      // Mock callback that throws
      const callback = jest.fn().mockRejectedValue(error);

      await expect(cacheService.getOrSet(key, callback)).rejects.toThrow('Callback failed');
      // The callback is called twice - once in the try block and once in the catch block
      expect(callback).toHaveBeenCalledTimes(2);

      // Verify nothing was cached
      expect(await cacheService.get(key)).toBeNull();
    });
  });

  describe('statistics', () => {
    it('should provide cache statistics', async () => {
      const stats = cacheService.getStats();
      
      expect(stats).toHaveProperty('keys');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(typeof stats.keys).toBe('number');
      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
    });

    it('should track hits and misses', async () => {
      const key = 'stats-test';
      const value = 'test-value';

      // Initial stats
      const initialStats = cacheService.getStats();
      const initialMisses = initialStats.misses;
      const initialHits = initialStats.hits;

      // Miss
      await cacheService.get('non-existent-1');
      await cacheService.get('non-existent-2');
      
      // Set and hit
      await cacheService.set(key, value);
      await cacheService.get(key);
      await cacheService.get(key);

      const finalStats = cacheService.getStats();
      
      expect(finalStats.misses).toBeGreaterThanOrEqual(initialMisses + 2);
      expect(finalStats.hits).toBeGreaterThanOrEqual(initialHits + 2);
    });
  });
});