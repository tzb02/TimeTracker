import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { indexedDBManager, TimeEntry, Project, OfflineQueueItem } from '../indexedDB';

// Mock IndexedDB
const mockDB = {
  transaction: vi.fn(),
  close: vi.fn(),
  objectStoreNames: {
    contains: vi.fn(() => false),
  },
  createObjectStore: vi.fn(() => ({
    createIndex: vi.fn(),
  })),
};

const mockTransaction = {
  objectStore: vi.fn(() => mockStore),
};

const mockStore = {
  get: vi.fn(() => mockRequest),
  getAll: vi.fn(() => mockRequest),
  put: vi.fn(() => mockRequest),
  delete: vi.fn(() => mockRequest),
  clear: vi.fn(() => mockRequest),
  index: vi.fn(() => mockStore),
};

const mockRequest = {
  onsuccess: null as any,
  onerror: null as any,
  result: null as any,
};

// Mock global IndexedDB
Object.defineProperty(global, 'indexedDB', {
  value: {
    open: vi.fn(() => {
      const request = {
        onsuccess: null as any,
        onerror: null as any,
        onupgradeneeded: null as any,
        result: mockDB,
      };
      
      // Simulate successful opening
      setTimeout(() => {
        if (request.onsuccess) {
          request.onsuccess();
        }
      }, 0);
      
      return request;
    }),
  },
});

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'mock-uuid-123'),
  },
});

describe('IndexedDB Manager', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockDB.transaction.mockReturnValue(mockTransaction);
    mockTransaction.objectStore.mockReturnValue(mockStore);
  });

  afterEach(async () => {
    await indexedDBManager.close();
  });

  describe('Initialization', () => {
    it('should initialize IndexedDB successfully', async () => {
      await expect(indexedDBManager.init()).resolves.not.toThrow();
    });

    it('should handle initialization errors gracefully', async () => {
      const originalOpen = global.indexedDB.open;
      global.indexedDB.open = vi.fn(() => {
        const request = {
          onsuccess: null as any,
          onerror: null as any,
          onupgradeneeded: null as any,
        };
        
        setTimeout(() => {
          if (request.onerror) {
            request.onerror();
          }
        }, 0);
        
        return request;
      });

      await expect(indexedDBManager.init()).rejects.toThrow('Failed to open IndexedDB');
      
      global.indexedDB.open = originalOpen;
    });
  });

  describe('Time Entries', () => {
    const mockTimeEntry: TimeEntry = {
      id: 'entry-1',
      userId: 'user-1',
      projectId: 'project-1',
      description: 'Test entry',
      startTime: new Date('2023-01-01T10:00:00Z'),
      endTime: new Date('2023-01-01T11:00:00Z'),
      duration: 3600,
      isRunning: false,
      tags: ['test'],
      createdAt: new Date('2023-01-01T10:00:00Z'),
      updatedAt: new Date('2023-01-01T11:00:00Z'),
      syncStatus: 'pending',
      lastModified: new Date('2023-01-01T11:00:00Z'),
    };

    beforeEach(async () => {
      await indexedDBManager.init();
    });

    it('should save time entry successfully', async () => {
      mockRequest.onsuccess = vi.fn();
      
      const promise = indexedDBManager.saveTimeEntry(mockTimeEntry);
      
      // Simulate successful save
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);
      
      await expect(promise).resolves.not.toThrow();
      expect(mockStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockTimeEntry,
          lastModified: expect.any(Date),
        })
      );
    });

    it('should get time entry by ID', async () => {
      mockRequest.result = mockTimeEntry;
      mockRequest.onsuccess = vi.fn();
      
      const promise = indexedDBManager.getTimeEntry('entry-1');
      
      // Simulate successful get
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);
      
      const result = await promise;
      expect(result).toEqual(mockTimeEntry);
      expect(mockStore.get).toHaveBeenCalledWith('entry-1');
    });

    it('should get all time entries for user', async () => {
      mockRequest.result = [mockTimeEntry];
      mockRequest.onsuccess = vi.fn();
      
      const promise = indexedDBManager.getTimeEntries('user-1');
      
      // Simulate successful getAll
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);
      
      const result = await promise;
      expect(result).toEqual([mockTimeEntry]);
      expect(mockStore.index).toHaveBeenCalledWith('userId');
      expect(mockStore.getAll).toHaveBeenCalledWith('user-1');
    });

    it('should delete time entry', async () => {
      mockRequest.onsuccess = vi.fn();
      
      const promise = indexedDBManager.deleteTimeEntry('entry-1');
      
      // Simulate successful delete
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);
      
      await expect(promise).resolves.not.toThrow();
      expect(mockStore.delete).toHaveBeenCalledWith('entry-1');
    });

    it('should get pending time entries', async () => {
      const pendingEntry = { ...mockTimeEntry, syncStatus: 'pending' as const };
      mockRequest.result = [pendingEntry];
      mockRequest.onsuccess = vi.fn();
      
      const promise = indexedDBManager.getPendingTimeEntries();
      
      // Simulate successful getAll
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);
      
      const result = await promise;
      expect(result).toEqual([pendingEntry]);
      expect(mockStore.index).toHaveBeenCalledWith('syncStatus');
      expect(mockStore.getAll).toHaveBeenCalledWith('pending');
    });
  });

  describe('Projects', () => {
    const mockProject: Project = {
      id: 'project-1',
      name: 'Test Project',
      color: '#3b82f6',
      description: 'Test project description',
      userId: 'user-1',
      isActive: true,
      createdAt: new Date('2023-01-01T10:00:00Z'),
      updatedAt: new Date('2023-01-01T10:00:00Z'),
      syncStatus: 'pending',
      lastModified: new Date('2023-01-01T10:00:00Z'),
    };

    beforeEach(async () => {
      await indexedDBManager.init();
    });

    it('should save project successfully', async () => {
      mockRequest.onsuccess = vi.fn();
      
      const promise = indexedDBManager.saveProject(mockProject);
      
      // Simulate successful save
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);
      
      await expect(promise).resolves.not.toThrow();
      expect(mockStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockProject,
          lastModified: expect.any(Date),
        })
      );
    });

    it('should get projects for user', async () => {
      mockRequest.result = [mockProject];
      mockRequest.onsuccess = vi.fn();
      
      const promise = indexedDBManager.getProjects('user-1');
      
      // Simulate successful getAll
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);
      
      const result = await promise;
      expect(result).toEqual([mockProject]);
      expect(mockStore.index).toHaveBeenCalledWith('userId');
      expect(mockStore.getAll).toHaveBeenCalledWith('user-1');
    });
  });

  describe('Offline Queue', () => {
    beforeEach(async () => {
      await indexedDBManager.init();
    });

    it('should add item to offline queue', async () => {
      mockRequest.onsuccess = vi.fn();
      
      const queueItem = {
        type: 'create' as const,
        endpoint: '/api/entries',
        method: 'POST' as const,
        data: { description: 'Test' },
        maxRetries: 3,
      };
      
      const promise = indexedDBManager.addToOfflineQueue(queueItem);
      
      // Simulate successful put
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);
      
      const result = await promise;
      expect(result).toBe('mock-uuid-123');
      expect(mockStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...queueItem,
          id: 'mock-uuid-123',
          timestamp: expect.any(Date),
          retryCount: 0,
        })
      );
    });

    it('should get offline queue items', async () => {
      const queueItem: OfflineQueueItem = {
        id: 'queue-1',
        type: 'create',
        endpoint: '/api/entries',
        method: 'POST',
        data: { description: 'Test' },
        timestamp: new Date('2023-01-01T10:00:00Z'),
        retryCount: 0,
        maxRetries: 3,
      };
      
      mockRequest.result = [queueItem];
      mockRequest.onsuccess = vi.fn();
      
      const promise = indexedDBManager.getOfflineQueue();
      
      // Simulate successful getAll
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);
      
      const result = await promise;
      expect(result).toEqual([queueItem]);
      expect(mockStore.getAll).toHaveBeenCalled();
    });

    it('should remove item from offline queue', async () => {
      mockRequest.onsuccess = vi.fn();
      
      const promise = indexedDBManager.removeFromOfflineQueue('queue-1');
      
      // Simulate successful delete
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);
      
      await expect(promise).resolves.not.toThrow();
      expect(mockStore.delete).toHaveBeenCalledWith('queue-1');
    });

    it('should clear offline queue', async () => {
      mockRequest.onsuccess = vi.fn();
      
      const promise = indexedDBManager.clearOfflineQueue();
      
      // Simulate successful clear
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);
      
      await expect(promise).resolves.not.toThrow();
      expect(mockStore.clear).toHaveBeenCalled();
    });
  });

  describe('Sync Metadata', () => {
    beforeEach(async () => {
      await indexedDBManager.init();
    });

    it('should set and get sync metadata', async () => {
      mockRequest.onsuccess = vi.fn();
      
      // Test setting metadata
      const setPromise = indexedDBManager.setSyncMetadata('testKey', 'testValue');
      
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);
      
      await expect(setPromise).resolves.not.toThrow();
      
      // Test getting metadata
      mockRequest.result = { key: 'testKey', value: 'testValue', timestamp: new Date() };
      
      const getPromise = indexedDBManager.getSyncMetadata('testKey');
      
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);
      
      const result = await getPromise;
      expect(result).toBe('testValue');
    });

    it('should handle last sync time', async () => {
      const testDate = new Date('2023-01-01T12:00:00Z');
      mockRequest.onsuccess = vi.fn();
      
      // Test setting last sync time
      const setPromise = indexedDBManager.setLastSyncTime(testDate);
      
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);
      
      await expect(setPromise).resolves.not.toThrow();
      
      // Test getting last sync time
      mockRequest.result = { key: 'lastSyncTime', value: testDate.toISOString(), timestamp: new Date() };
      
      const getPromise = indexedDBManager.getLastSyncTime();
      
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);
      
      const result = await getPromise;
      expect(result).toEqual(testDate);
    });
  });

  describe('Storage Usage', () => {
    it('should get storage usage when supported', async () => {
      // Mock navigator.storage
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn().mockResolvedValue({
            usage: 1024 * 1024, // 1MB
            quota: 10 * 1024 * 1024, // 10MB
          }),
        },
        configurable: true,
      });

      const result = await indexedDBManager.getStorageUsage();
      expect(result).toEqual({
        used: 1024 * 1024,
        quota: 10 * 1024 * 1024,
      });
    });

    it('should return zero usage when not supported', async () => {
      // Remove navigator.storage
      delete (navigator as any).storage;

      const result = await indexedDBManager.getStorageUsage();
      expect(result).toEqual({
        used: 0,
        quota: 0,
      });
    });
  });
});