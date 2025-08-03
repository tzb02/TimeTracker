import { useState, useEffect, useCallback } from 'react';
import { syncManager, SyncResult } from '../utils/syncManager';
import { indexedDBManager } from '../utils/indexedDB';
import { useAppStore } from '../store/useAppStore';

export interface OfflineStats {
  queuedItems: number;
  pendingEntries: number;
  pendingProjects: number;
  storageUsed: number;
  storageQuota: number;
}

export const useOffline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [offlineStats, setOfflineStats] = useState<OfflineStats>({
    queuedItems: 0,
    pendingEntries: 0,
    pendingProjects: 0,
    storageUsed: 0,
    storageQuota: 0,
  });

  const { setOffline } = useAppStore();

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setOffline(false);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial offline state
    setOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOffline]);

  // Listen for sync events
  useEffect(() => {
    const handleSyncStart = () => setIsSyncing(true);
    const handleSyncResult = (result: SyncResult) => {
      setIsSyncing(false);
      setLastSyncResult(result);
      updateOfflineStats(); // Refresh stats after sync
    };

    syncManager.onSync(handleSyncResult);
    
    // Check if sync is already in progress
    setIsSyncing(syncManager.isSyncInProgress());

    return () => {
      syncManager.offSync(handleSyncResult);
    };
  }, []);

  // Update offline stats periodically
  const updateOfflineStats = useCallback(async () => {
    try {
      const [queueItems, pendingEntries, pendingProjects, storageInfo] = await Promise.all([
        indexedDBManager.getOfflineQueue(),
        indexedDBManager.getPendingTimeEntries(),
        indexedDBManager.getPendingProjects(),
        indexedDBManager.getStorageUsage(),
      ]);

      setOfflineStats({
        queuedItems: queueItems.length,
        pendingEntries: pendingEntries.length,
        pendingProjects: pendingProjects.length,
        storageUsed: storageInfo.used,
        storageQuota: storageInfo.quota,
      });
    } catch (error) {
      console.error('Failed to update offline stats:', error);
    }
  }, []);

  useEffect(() => {
    updateOfflineStats();
    
    // Update stats every 30 seconds
    const interval = setInterval(updateOfflineStats, 30000);
    
    return () => clearInterval(interval);
  }, [updateOfflineStats]);

  // Manual sync trigger
  const triggerSync = useCallback(async (): Promise<SyncResult> => {
    if (!isOnline || isSyncing) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        conflicts: 0,
        errors: ['Cannot sync: offline or sync in progress']
      };
    }

    setIsSyncing(true);
    try {
      const result = await syncManager.triggerSync();
      return result;
    } catch (error) {
      const errorResult: SyncResult = {
        success: false,
        synced: 0,
        failed: 0,
        conflicts: 0,
        errors: [error instanceof Error ? error.message : 'Sync failed']
      };
      setLastSyncResult(errorResult);
      return errorResult;
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing]);

  // Queue operation for offline sync
  const queueOperation = useCallback(async (
    type: 'create' | 'update' | 'delete',
    endpoint: string,
    data?: any
  ): Promise<string> => {
    const method = type === 'create' ? 'POST' : type === 'update' ? 'PUT' : 'DELETE';
    
    const queueId = await indexedDBManager.addToOfflineQueue({
      type,
      endpoint,
      method,
      data,
      maxRetries: 3,
    });

    // Update stats
    updateOfflineStats();

    // Request background sync if available
    if (isOnline) {
      try {
        await syncManager.requestBackgroundSync();
      } catch (error) {
        console.warn('Background sync not available');
      }
    }

    return queueId;
  }, [isOnline, updateOfflineStats]);

  // Save data locally (for offline use)
  const saveLocally = useCallback(async (type: 'timeEntry' | 'project', data: any) => {
    try {
      if (type === 'timeEntry') {
        await indexedDBManager.saveTimeEntry({
          ...data,
          syncStatus: 'pending',
          lastModified: new Date(),
        });
      } else if (type === 'project') {
        await indexedDBManager.saveProject({
          ...data,
          syncStatus: 'pending',
          lastModified: new Date(),
        });
      }
      
      updateOfflineStats();
    } catch (error) {
      console.error('Failed to save data locally:', error);
      throw error;
    }
  }, [updateOfflineStats]);

  // Get local data (for offline use)
  const getLocalData = useCallback(async (type: 'timeEntries' | 'projects', userId: string) => {
    try {
      if (type === 'timeEntries') {
        return await indexedDBManager.getTimeEntries(userId);
      } else if (type === 'projects') {
        return await indexedDBManager.getProjects(userId);
      }
      return [];
    } catch (error) {
      console.error('Failed to get local data:', error);
      return [];
    }
  }, []);

  // Clear offline data
  const clearOfflineData = useCallback(async () => {
    try {
      await Promise.all([
        indexedDBManager.clearOfflineQueue(),
        indexedDBManager.clear('timeEntries'),
        indexedDBManager.clear('projects'),
      ]);
      updateOfflineStats();
    } catch (error) {
      console.error('Failed to clear offline data:', error);
      throw error;
    }
  }, [updateOfflineStats]);

  // Get storage usage percentage
  const getStorageUsagePercentage = useCallback((): number => {
    if (offlineStats.storageQuota === 0) return 0;
    return (offlineStats.storageUsed / offlineStats.storageQuota) * 100;
  }, [offlineStats]);

  // Check if storage is nearly full (>80%)
  const isStorageNearlyFull = useCallback((): boolean => {
    return getStorageUsagePercentage() > 80;
  }, [getStorageUsagePercentage]);

  return {
    // Status
    isOnline,
    isSyncing,
    lastSyncResult,
    offlineStats,
    
    // Actions
    triggerSync,
    queueOperation,
    saveLocally,
    getLocalData,
    clearOfflineData,
    updateOfflineStats,
    
    // Utilities
    getStorageUsagePercentage,
    isStorageNearlyFull,
    
    // Computed values
    hasOfflineData: offlineStats.queuedItems > 0 || offlineStats.pendingEntries > 0 || offlineStats.pendingProjects > 0,
    canSync: isOnline && !isSyncing,
  };
};