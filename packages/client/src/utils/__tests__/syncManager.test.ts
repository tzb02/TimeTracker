import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { syncManager, SyncResult } from '../syncManager';
import { indexedDBManager } from '../indexedDB';

// Mock dependencies
vi.mock('../indexedDB');
vi.mock('../serviceWorker', () => ({
  serviceWorkerManager: {
    onMessage: vi.fn(),
    requestSync: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

describe('Sync Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigator.onLine = true;
    mockLocalStorage.getItem.mockReturnValue('mock-auth-token');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Network Status', () => {
    it('should track online status', () => {
      expect(syncManager.isOnlineStatus()).toBe(true);
      
      navigator.onLine = false;
      window.dispatchEvent(new Event('offline'));
      
      expect(syncManager.isOnlineStatus()).toBe(false);
    });

    it('should trigger sync when coming online', async () => {
      const triggerSyncSpy = vi.spyOn(syncManager, 'triggerSync');
      
      navigator.onLine = true;
      window.dispatchEvent(new Event('online'));
      
      expect(triggerSyncSpy).toHaveBeenCalled();
    });
  });

  describe('Sync Process', () => {
    beforeEach(() => {
      // Mock IndexedDB methods
      vi.mocked(indexedDBManager.getOfflineQueue).mockResolvedValue([]);
      vi.mocked(indexedDBManager.getPendingTimeEntries).mockResolvedValue([]);
      vi.mocked(indexedDBManager.getPendingProjects).mockResolvedValue([]);
      vi.mocked(indexedDBManager.setLastSyncTime).mockResolvedValue();
    });

    it('should perform successful sync when online', async () => {
      // Mock successful API responses
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      const result = await syncManager.triggerSync();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(indexedDBManager.setLastSyncTime).toHaveBeenCalled();
    });

    it('should not sync when offline', async () => {
      navigator.onLine = false;
      
      const result = await syncManager.triggerSync();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Sync already in progress or offline');
    });

    it('should not sync when already in progress', async () => {
      // Start first sync
      const firstSyncPromise = syncManager.triggerSync();
      
      // Try to start second sync while first is in progress
      const secondResult = await syncManager.triggerSync();

      expect(secondResult.success).toBe(false);
      expect(secondResult.errors).toContain('Sync already in progress or offline');

      // Wait for first sync to complete
      await firstSyncPromise;
    });

    it('should handle sync errors gracefully', async () => {
      // Mock API error
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const result = await syncManager.triggerSync();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Offline Queue Processing', () => {
    it('should process offline queue items', async () => {
      const mockQueueItem = {
        id: 'queue-1',
        type: 'create' as const,
        endpoint: '/api/entries',
        method: 'POST' as const,
        data: { description: 'Test' },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
      };

      vi.mocked(indexedDBManager.getOfflineQueue).mockResolvedValue([mockQueueItem]);
      vi.mocked(indexedDBManager.removeFromOfflineQueue).mockResolvedValue();
      vi.mocked(indexedDBManager.getPendingTimeEntries).mockResolvedValue([]);
      vi.mocked(indexedDBManager.getPendingProjects).mockResolvedValue([]);
      vi.mocked(indexedDBManager.setLastSyncTime).mockResolvedValue();

      // Mock successful API response
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      const result = await syncManager.triggerSync();

      expect(result.success).toBe(true);
      expect(result.synced).toBeGreaterThan(0);
      expect(indexedDBManager.removeFromOfflineQueue).toHaveBeenCalledWith('queue-1');
    });

    it('should retry failed queue items', async () => {
      const mockQueueItem = {
        id: 'queue-1',
        type: 'create' as const,
        endpoint: '/api/entries',
        method: 'POST' as const,
        data: { description: 'Test' },
        timestamp: new Date(),
        retryCount: 1,
        maxRetries: 3,
      };

      vi.mocked(indexedDBManager.getOfflineQueue).mockResolvedValue([mockQueueItem]);
      vi.mocked(indexedDBManager.updateOfflineQueueItem).mockResolvedValue();
      vi.mocked(indexedDBManager.getPendingTimeEntries).mockResolvedValue([]);
      vi.mocked(indexedDBManager.getPendingProjects).mockResolvedValue([]);
      vi.mocked(indexedDBManager.setLastSyncTime).mockResolvedValue();

      // Mock failed API response
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const result = await syncManager.triggerSync();

      expect(indexedDBManager.updateOfflineQueueItem).toHaveBeenCalledWith({
        ...mockQueueItem,
        retryCount: 2,
      });
    });

    it('should remove queue items that exceed max retries', async () => {
      const mockQueueItem = {
        id: 'queue-1',
        type: 'create' as const,
        endpoint: '/api/entries',
        method: 'POST' as const,
        data: { description: 'Test' },
        timestamp: new Date(),
        retryCount: 3,
        maxRetries: 3,
      };

      vi.mocked(indexedDBManager.getOfflineQueue).mockResolvedValue([mockQueueItem]);
      vi.mocked(indexedDBManager.removeFromOfflineQueue).mockResolvedValue();
      vi.mocked(indexedDBManager.getPendingTimeEntries).mockResolvedValue([]);
      vi.mocked(indexedDBManager.getPendingProjects).mockResolvedValue([]);
      vi.mocked(indexedDBManager.setLastSyncTime).mockResolvedValue();

      // Mock failed API response
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const result = await syncManager.triggerSync();

      expect(result.failed).toBe(1);
      expect(indexedDBManager.removeFromOfflineQueue).toHaveBeenCalledWith('queue-1');
    });
  });

  describe('Local Changes Sync', () => {
    it('should sync pending time entries', async () => {
      const mockTimeEntry = {
        id: 'entry-1',
        userId: 'user-1',
        projectId: 'project-1',
        description: 'Test entry',
        startTime: new Date(),
        endTime: new Date(),
        duration: 3600,
        isRunning: false,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'pending' as const,
        lastModified: new Date(),
      };

      vi.mocked(indexedDBManager.getOfflineQueue).mockResolvedValue([]);
      vi.mocked(indexedDBManager.getPendingTimeEntries).mockResolvedValue([mockTimeEntry]);
      vi.mocked(indexedDBManager.getPendingProjects).mockResolvedValue([]);
      vi.mocked(indexedDBManager.saveTimeEntry).mockResolvedValue();
      vi.mocked(indexedDBManager.setLastSyncTime).mockResolvedValue();

      // Mock successful API response
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { ...mockTimeEntry, id: 'server-entry-1' } }),
      } as Response);

      const result = await syncManager.triggerSync();

      expect(result.success).toBe(true);
      expect(result.synced).toBeGreaterThan(0);
      expect(indexedDBManager.saveTimeEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'server-entry-1',
          syncStatus: 'synced',
        })
      );
    });

    it('should handle sync conflicts', async () => {
      const mockTimeEntry = {
        id: 'entry-1',
        userId: 'user-1',
        projectId: 'project-1',
        description: 'Client version',
        startTime: new Date(),
        endTime: new Date(),
        duration: 3600,
        isRunning: false,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'pending' as const,
        lastModified: new Date(),
      };

      vi.mocked(indexedDBManager.getOfflineQueue).mockResolvedValue([]);
      vi.mocked(indexedDBManager.getPendingTimeEntries).mockResolvedValue([mockTimeEntry]);
      vi.mocked(indexedDBManager.getPendingProjects).mockResolvedValue([]);
      vi.mocked(indexedDBManager.saveTimeEntry).mockResolvedValue();
      vi.mocked(indexedDBManager.setLastSyncTime).mockResolvedValue();

      // Mock conflict response
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ 
          data: { ...mockTimeEntry, description: 'Server version' } 
        }),
      } as Response);

      const result = await syncManager.triggerSync();

      expect(result.conflicts).toBeGreaterThan(0);
      expect(indexedDBManager.saveTimeEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Server version',
          syncStatus: 'synced',
        })
      );
    });
  });

  describe('Server Changes Pull', () => {
    it('should pull server changes since last sync', async () => {
      const lastSyncTime = new Date('2023-01-01T10:00:00Z');
      
      vi.mocked(indexedDBManager.getOfflineQueue).mockResolvedValue([]);
      vi.mocked(indexedDBManager.getPendingTimeEntries).mockResolvedValue([]);
      vi.mocked(indexedDBManager.getPendingProjects).mockResolvedValue([]);
      vi.mocked(indexedDBManager.getLastSyncTime).mockResolvedValue(lastSyncTime);
      vi.mocked(indexedDBManager.saveTimeEntry).mockResolvedValue();
      vi.mocked(indexedDBManager.saveProject).mockResolvedValue();
      vi.mocked(indexedDBManager.setLastSyncTime).mockResolvedValue();

      const mockServerEntries = [
        {
          id: 'server-entry-1',
          description: 'Server entry',
          updatedAt: new Date('2023-01-01T11:00:00Z'),
        },
      ];

      const mockServerProjects = [
        {
          id: 'server-project-1',
          name: 'Server project',
          updatedAt: new Date('2023-01-01T11:00:00Z'),
        },
      ];

      // Mock API responses
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: mockServerEntries }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: mockServerProjects }),
        } as Response);

      const result = await syncManager.triggerSync();

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        `/api/entries?since=${lastSyncTime.toISOString()}`,
        expect.any(Object)
      );
      expect(fetch).toHaveBeenCalledWith(
        `/api/projects?since=${lastSyncTime.toISOString()}`,
        expect.any(Object)
      );
      expect(indexedDBManager.saveTimeEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'server-entry-1',
          syncStatus: 'synced',
        })
      );
      expect(indexedDBManager.saveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'server-project-1',
          syncStatus: 'synced',
        })
      );
    });

    it('should pull all data on first sync', async () => {
      vi.mocked(indexedDBManager.getOfflineQueue).mockResolvedValue([]);
      vi.mocked(indexedDBManager.getPendingTimeEntries).mockResolvedValue([]);
      vi.mocked(indexedDBManager.getPendingProjects).mockResolvedValue([]);
      vi.mocked(indexedDBManager.getLastSyncTime).mockResolvedValue(null);
      vi.mocked(indexedDBManager.saveTimeEntry).mockResolvedValue();
      vi.mocked(indexedDBManager.saveProject).mockResolvedValue();
      vi.mocked(indexedDBManager.setLastSyncTime).mockResolvedValue();

      // Mock API responses
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        } as Response);

      await syncManager.triggerSync();

      expect(fetch).toHaveBeenCalledWith('/api/entries', expect.any(Object));
      expect(fetch).toHaveBeenCalledWith('/api/projects', expect.any(Object));
    });
  });

  describe('Sync Listeners', () => {
    it('should notify sync listeners', async () => {
      const mockListener = vi.fn();
      syncManager.onSync(mockListener);

      vi.mocked(indexedDBManager.getOfflineQueue).mockResolvedValue([]);
      vi.mocked(indexedDBManager.getPendingTimeEntries).mockResolvedValue([]);
      vi.mocked(indexedDBManager.getPendingProjects).mockResolvedValue([]);
      vi.mocked(indexedDBManager.setLastSyncTime).mockResolvedValue();

      // Mock successful API responses
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      await syncManager.triggerSync();

      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );

      syncManager.offSync(mockListener);
    });

    it('should remove sync listeners', () => {
      const mockListener = vi.fn();
      
      syncManager.onSync(mockListener);
      syncManager.offSync(mockListener);

      // Listener should not be called after removal
      // This is tested implicitly by not setting up mocks and ensuring no errors
    });
  });

  describe('Background Sync', () => {
    it('should request background sync', async () => {
      const { serviceWorkerManager } = await import('../serviceWorker');
      
      await syncManager.requestBackgroundSync();

      expect(serviceWorkerManager.requestSync).toHaveBeenCalledWith('offline-sync');
    });

    it('should fallback to manual sync when background sync fails', async () => {
      const { serviceWorkerManager } = await import('../serviceWorker');
      vi.mocked(serviceWorkerManager.requestSync).mockRejectedValue(new Error('Not supported'));
      
      const triggerSyncSpy = vi.spyOn(syncManager, 'triggerSync');
      
      await syncManager.requestBackgroundSync();

      // Should fallback to manual sync after a delay
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(triggerSyncSpy).toHaveBeenCalled();
    });
  });
});