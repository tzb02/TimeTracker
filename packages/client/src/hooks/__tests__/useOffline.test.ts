import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOffline } from '../useOffline';
import { syncManager } from '../../utils/syncManager';
import { indexedDBManager } from '../../utils/indexedDB';

// Mock dependencies
vi.mock('../../utils/syncManager');
vi.mock('../../utils/indexedDB');
vi.mock('../../store/useAppStore', () => ({
  useAppStore: () => ({
    setOffline: vi.fn(),
  }),
}));

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

describe('useOffline Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigator.onLine = true;
    
    // Mock IndexedDB methods
    vi.mocked(indexedDBManager.getOfflineQueue).mockResolvedValue([]);
    vi.mocked(indexedDBManager.getPendingTimeEntries).mockResolvedValue([]);
    vi.mocked(indexedDBManager.getPendingProjects).mockResolvedValue([]);
    vi.mocked(indexedDBManager.getStorageUsage).mockResolvedValue({
      used: 1024 * 1024, // 1MB
      quota: 10 * 1024 * 1024, // 10MB
    });
    
    // Mock sync manager methods
    vi.mocked(syncManager.isOnlineStatus).mockReturnValue(true);
    vi.mocked(syncManager.isSyncInProgress).mockReturnValue(false);
    vi.mocked(syncManager.triggerSync).mockResolvedValue({
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
    });
    vi.mocked(syncManager.onSync).mockImplementation(() => {});
    vi.mocked(syncManager.offSync).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Online Status', () => {
    it('should track online status correctly', () => {
      const { result } = renderHook(() => useOffline());
      
      expect(result.current.isOnline).toBe(true);
    });

    it('should update online status when network changes', () => {
      const { result } = renderHook(() => useOffline());
      
      act(() => {
        navigator.onLine = false;
        window.dispatchEvent(new Event('offline'));
      });
      
      expect(result.current.isOnline).toBe(false);
      
      act(() => {
        navigator.onLine = true;
        window.dispatchEvent(new Event('online'));
      });
      
      expect(result.current.isOnline).toBe(true);
    });
  });

  describe('Sync Status', () => {
    it('should track sync status', () => {
      const { result } = renderHook(() => useOffline());
      
      expect(result.current.isSyncing).toBe(false);
    });

    it('should update sync status from sync manager', () => {
      vi.mocked(syncManager.isSyncInProgress).mockReturnValue(true);
      
      const { result } = renderHook(() => useOffline());
      
      expect(result.current.isSyncing).toBe(true);
    });
  });

  describe('Offline Stats', () => {
    it('should load offline stats on mount', async () => {
      const mockQueueItems = [
        { id: '1', type: 'create' as const, endpoint: '/api/entries', method: 'POST' as const, data: {}, timestamp: new Date(), retryCount: 0, maxRetries: 3 },
      ];
      const mockPendingEntries = [
        { id: 'entry-1', syncStatus: 'pending' as const } as any,
      ];
      const mockPendingProjects = [
        { id: 'project-1', syncStatus: 'pending' as const } as any,
      ];

      vi.mocked(indexedDBManager.getOfflineQueue).mockResolvedValue(mockQueueItems);
      vi.mocked(indexedDBManager.getPendingTimeEntries).mockResolvedValue(mockPendingEntries);
      vi.mocked(indexedDBManager.getPendingProjects).mockResolvedValue(mockPendingProjects);

      const { result } = renderHook(() => useOffline());

      // Wait for async operations to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.offlineStats.queuedItems).toBe(1);
      expect(result.current.offlineStats.pendingEntries).toBe(1);
      expect(result.current.offlineStats.pendingProjects).toBe(1);
      expect(result.current.offlineStats.storageUsed).toBe(1024 * 1024);
      expect(result.current.offlineStats.storageQuota).toBe(10 * 1024 * 1024);
    });

    it('should calculate storage usage percentage', async () => {
      const { result } = renderHook(() => useOffline());

      // Wait for stats to load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const percentage = result.current.getStorageUsagePercentage();
      expect(percentage).toBe(10); // 1MB / 10MB * 100
    });

    it('should detect when storage is nearly full', async () => {
      vi.mocked(indexedDBManager.getStorageUsage).mockResolvedValue({
        used: 9 * 1024 * 1024, // 9MB
        quota: 10 * 1024 * 1024, // 10MB
      });

      const { result } = renderHook(() => useOffline());

      // Wait for stats to load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isStorageNearlyFull()).toBe(true);
    });
  });

  describe('Sync Operations', () => {
    it('should trigger sync when online', async () => {
      const { result } = renderHook(() => useOffline());

      await act(async () => {
        const syncResult = await result.current.triggerSync();
        expect(syncResult.success).toBe(true);
      });

      expect(syncManager.triggerSync).toHaveBeenCalled();
    });

    it('should not sync when offline', async () => {
      navigator.onLine = false;
      vi.mocked(syncManager.isOnlineStatus).mockReturnValue(false);

      const { result } = renderHook(() => useOffline());

      await act(async () => {
        const syncResult = await result.current.triggerSync();
        expect(syncResult.success).toBe(false);
        expect(syncResult.errors).toContain('Cannot sync: offline or sync in progress');
      });
    });

    it('should not sync when already syncing', async () => {
      vi.mocked(syncManager.isSyncInProgress).mockReturnValue(true);

      const { result } = renderHook(() => useOffline());

      await act(async () => {
        const syncResult = await result.current.triggerSync();
        expect(syncResult.success).toBe(false);
        expect(syncResult.errors).toContain('Cannot sync: offline or sync in progress');
      });
    });
  });

  describe('Queue Operations', () => {
    it('should queue operations for offline sync', async () => {
      vi.mocked(indexedDBManager.addToOfflineQueue).mockResolvedValue('queue-id-123');

      const { result } = renderHook(() => useOffline());

      await act(async () => {
        const queueId = await result.current.queueOperation('create', '/api/entries', { description: 'Test' });
        expect(queueId).toBe('queue-id-123');
      });

      expect(indexedDBManager.addToOfflineQueue).toHaveBeenCalledWith({
        type: 'create',
        endpoint: '/api/entries',
        method: 'POST',
        data: { description: 'Test' },
        maxRetries: 3,
      });
    });

    it('should request background sync when online', async () => {
      vi.mocked(indexedDBManager.addToOfflineQueue).mockResolvedValue('queue-id-123');
      vi.mocked(syncManager.requestBackgroundSync).mockResolvedValue();

      const { result } = renderHook(() => useOffline());

      await act(async () => {
        await result.current.queueOperation('create', '/api/entries', { description: 'Test' });
      });

      expect(syncManager.requestBackgroundSync).toHaveBeenCalled();
    });
  });

  describe('Local Data Operations', () => {
    it('should save time entries locally', async () => {
      vi.mocked(indexedDBManager.saveTimeEntry).mockResolvedValue();

      const { result } = renderHook(() => useOffline());

      const timeEntryData = {
        id: 'entry-1',
        description: 'Test entry',
        projectId: 'project-1',
      };

      await act(async () => {
        await result.current.saveLocally('timeEntry', timeEntryData);
      });

      expect(indexedDBManager.saveTimeEntry).toHaveBeenCalledWith({
        ...timeEntryData,
        syncStatus: 'pending',
        lastModified: expect.any(Date),
      });
    });

    it('should save projects locally', async () => {
      vi.mocked(indexedDBManager.saveProject).mockResolvedValue();

      const { result } = renderHook(() => useOffline());

      const projectData = {
        id: 'project-1',
        name: 'Test Project',
        color: '#3b82f6',
      };

      await act(async () => {
        await result.current.saveLocally('project', projectData);
      });

      expect(indexedDBManager.saveProject).toHaveBeenCalledWith({
        ...projectData,
        syncStatus: 'pending',
        lastModified: expect.any(Date),
      });
    });

    it('should get local time entries', async () => {
      const mockEntries = [
        { id: 'entry-1', description: 'Test entry' } as any,
      ];
      vi.mocked(indexedDBManager.getTimeEntries).mockResolvedValue(mockEntries);

      const { result } = renderHook(() => useOffline());

      await act(async () => {
        const entries = await result.current.getLocalData('timeEntries', 'user-1');
        expect(entries).toEqual(mockEntries);
      });

      expect(indexedDBManager.getTimeEntries).toHaveBeenCalledWith('user-1');
    });

    it('should get local projects', async () => {
      const mockProjects = [
        { id: 'project-1', name: 'Test Project' } as any,
      ];
      vi.mocked(indexedDBManager.getProjects).mockResolvedValue(mockProjects);

      const { result } = renderHook(() => useOffline());

      await act(async () => {
        const projects = await result.current.getLocalData('projects', 'user-1');
        expect(projects).toEqual(mockProjects);
      });

      expect(indexedDBManager.getProjects).toHaveBeenCalledWith('user-1');
    });
  });

  describe('Data Cleanup', () => {
    it('should clear offline data', async () => {
      vi.mocked(indexedDBManager.clearOfflineQueue).mockResolvedValue();
      vi.mocked(indexedDBManager.clear).mockResolvedValue();

      const { result } = renderHook(() => useOffline());

      await act(async () => {
        await result.current.clearOfflineData();
      });

      expect(indexedDBManager.clearOfflineQueue).toHaveBeenCalled();
      expect(indexedDBManager.clear).toHaveBeenCalledWith('timeEntries');
      expect(indexedDBManager.clear).toHaveBeenCalledWith('projects');
    });
  });

  describe('Computed Values', () => {
    it('should detect when there is offline data', async () => {
      vi.mocked(indexedDBManager.getOfflineQueue).mockResolvedValue([
        { id: '1' } as any,
      ]);

      const { result } = renderHook(() => useOffline());

      // Wait for stats to load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.hasOfflineData).toBe(true);
    });

    it('should detect when sync is possible', () => {
      const { result } = renderHook(() => useOffline());

      expect(result.current.canSync).toBe(true);
    });

    it('should detect when sync is not possible', () => {
      navigator.onLine = false;
      vi.mocked(syncManager.isOnlineStatus).mockReturnValue(false);

      const { result } = renderHook(() => useOffline());

      expect(result.current.canSync).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      
      const { unmount } = renderHook(() => useOffline());
      
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(syncManager.offSync).toHaveBeenCalled();
    });
  });
});