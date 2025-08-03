// Data synchronization manager for online/offline transitions

import { indexedDBManager, TimeEntry, Project, OfflineQueueItem } from './indexedDB';
import { serviceWorkerManager } from './serviceWorker';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  conflicts: number;
  errors: string[];
}

export interface ConflictResolution {
  strategy: 'client' | 'server' | 'merge';
  data?: any;
}

class SyncManager {
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private syncListeners: Set<(result: SyncResult) => void> = new Set();
  private conflictResolvers: Map<string, (clientData: any, serverData: any) => ConflictResolution> = new Map();

  constructor() {
    this.setupNetworkListeners();
    this.setupServiceWorkerListeners();
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('Network: Online');
      this.isOnline = true;
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      console.log('Network: Offline');
      this.isOnline = false;
    });
  }

  private setupServiceWorkerListeners(): void {
    serviceWorkerManager.onMessage('SYNC_OFFLINE_DATA', () => {
      this.triggerSync();
    });

    serviceWorkerManager.onMessage('QUEUE_REQUEST', (data) => {
      this.handleOfflineRequest(data.request);
    });
  }

  // Public API
  async triggerSync(): Promise<SyncResult> {
    if (!this.isOnline || this.syncInProgress) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        conflicts: 0,
        errors: ['Sync already in progress or offline']
      };
    }

    this.syncInProgress = true;
    console.log('Starting data synchronization...');

    try {
      const result = await this.performSync();
      this.notifySyncListeners(result);
      return result;
    } catch (error) {
      console.error('Sync failed:', error);
      const errorResult: SyncResult = {
        success: false,
        synced: 0,
        failed: 0,
        conflicts: 0,
        errors: [error instanceof Error ? error.message : 'Unknown sync error']
      };
      this.notifySyncListeners(errorResult);
      return errorResult;
    } finally {
      this.syncInProgress = false;
    }
  }

  private async performSync(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
      errors: []
    };

    try {
      // 1. Process offline queue first
      const queueResult = await this.processOfflineQueue();
      result.synced += queueResult.synced;
      result.failed += queueResult.failed;
      result.errors.push(...queueResult.errors);

      // 2. Sync pending local changes
      const localResult = await this.syncLocalChanges();
      result.synced += localResult.synced;
      result.failed += localResult.failed;
      result.conflicts += localResult.conflicts;
      result.errors.push(...localResult.errors);

      // 3. Pull server changes
      const serverResult = await this.pullServerChanges();
      result.synced += serverResult.synced;
      result.conflicts += serverResult.conflicts;
      result.errors.push(...serverResult.errors);

      // 4. Update last sync time
      await indexedDBManager.setLastSyncTime(new Date());

      result.success = result.errors.length === 0;
      console.log('Sync completed:', result);

    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Sync process failed');
    }

    return result;
  }

  private async processOfflineQueue(): Promise<SyncResult> {
    const result: SyncResult = { success: true, synced: 0, failed: 0, conflicts: 0, errors: [] };
    const queue = await indexedDBManager.getOfflineQueue();

    for (const item of queue) {
      try {
        const success = await this.processQueueItem(item);
        if (success) {
          await indexedDBManager.removeFromOfflineQueue(item.id);
          result.synced++;
        } else {
          // Increment retry count
          item.retryCount++;
          if (item.retryCount >= item.maxRetries) {
            await indexedDBManager.removeFromOfflineQueue(item.id);
            result.failed++;
            result.errors.push(`Max retries exceeded for ${item.endpoint}`);
          } else {
            await indexedDBManager.updateOfflineQueueItem(item);
          }
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Queue item ${item.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return result;
  }

  private async processQueueItem(item: OfflineQueueItem): Promise<boolean> {
    try {
      const response = await fetch(item.endpoint, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          // Add auth headers if available
          ...this.getAuthHeaders(),
        },
        body: item.data ? JSON.stringify(item.data) : undefined,
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to process queue item:', error);
      return false;
    }
  }

  private async syncLocalChanges(): Promise<SyncResult> {
    const result: SyncResult = { success: true, synced: 0, failed: 0, conflicts: 0, errors: [] };

    // Sync pending time entries
    const pendingEntries = await indexedDBManager.getPendingTimeEntries();
    for (const entry of pendingEntries) {
      try {
        const syncResult = await this.syncTimeEntry(entry);
        if (syncResult.success) {
          result.synced++;
        } else if (syncResult.conflict) {
          result.conflicts++;
        } else {
          result.failed++;
          result.errors.push(`Time entry ${entry.id}: ${syncResult.error}`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Time entry ${entry.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Sync pending projects
    const pendingProjects = await indexedDBManager.getPendingProjects();
    for (const project of pendingProjects) {
      try {
        const syncResult = await this.syncProject(project);
        if (syncResult.success) {
          result.synced++;
        } else if (syncResult.conflict) {
          result.conflicts++;
        } else {
          result.failed++;
          result.errors.push(`Project ${project.id}: ${syncResult.error}`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Project ${project.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return result;
  }

  private async syncTimeEntry(entry: TimeEntry): Promise<{ success: boolean; conflict?: boolean; error?: string }> {
    try {
      const isNew = entry.localId && !entry.id.startsWith('local_');
      const endpoint = isNew ? '/api/entries' : `/api/entries/${entry.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          projectId: entry.projectId,
          description: entry.description,
          startTime: entry.startTime,
          endTime: entry.endTime,
          duration: entry.duration,
          tags: entry.tags,
        }),
      });

      if (response.ok) {
        const serverEntry = await response.json();
        // Update local entry with server data
        await indexedDBManager.saveTimeEntry({
          ...entry,
          ...serverEntry.data,
          syncStatus: 'synced',
        });
        return { success: true };
      } else if (response.status === 409) {
        // Conflict - handle based on strategy
        const serverEntry = await response.json();
        const resolution = await this.resolveConflict('timeEntry', entry, serverEntry.data);
        
        if (resolution.strategy === 'client') {
          // Force update with client data
          const forceResponse = await fetch(`${endpoint}?force=true`, {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...this.getAuthHeaders(),
            },
            body: JSON.stringify(entry),
          });
          
          if (forceResponse.ok) {
            await indexedDBManager.saveTimeEntry({ ...entry, syncStatus: 'synced' });
            return { success: true };
          }
        } else if (resolution.strategy === 'server') {
          // Accept server data
          await indexedDBManager.saveTimeEntry({
            ...serverEntry.data,
            syncStatus: 'synced',
          });
          return { success: true };
        } else {
          // Merge strategy
          const mergedData = resolution.data || entry;
          await indexedDBManager.saveTimeEntry({
            ...mergedData,
            syncStatus: 'synced',
          });
          return { success: true };
        }
        
        return { success: false, conflict: true };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  private async syncProject(project: Project): Promise<{ success: boolean; conflict?: boolean; error?: string }> {
    try {
      const isNew = project.localId && !project.id.startsWith('local_');
      const endpoint = isNew ? '/api/projects' : `/api/projects/${project.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          name: project.name,
          color: project.color,
          description: project.description,
          isActive: project.isActive,
        }),
      });

      if (response.ok) {
        const serverProject = await response.json();
        await indexedDBManager.saveProject({
          ...project,
          ...serverProject.data,
          syncStatus: 'synced',
        });
        return { success: true };
      } else if (response.status === 409) {
        const serverProject = await response.json();
        const resolution = await this.resolveConflict('project', project, serverProject.data);
        
        // Handle conflict resolution similar to time entries
        if (resolution.strategy === 'server') {
          await indexedDBManager.saveProject({
            ...serverProject.data,
            syncStatus: 'synced',
          });
          return { success: true };
        }
        
        return { success: false, conflict: true };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  private async pullServerChanges(): Promise<SyncResult> {
    const result: SyncResult = { success: true, synced: 0, failed: 0, conflicts: 0, errors: [] };
    const lastSync = await indexedDBManager.getLastSyncTime();

    try {
      // Pull time entries
      const entriesUrl = lastSync 
        ? `/api/entries?since=${lastSync.toISOString()}`
        : '/api/entries';
      
      const entriesResponse = await fetch(entriesUrl, {
        headers: this.getAuthHeaders(),
      });

      if (entriesResponse.ok) {
        const entriesData = await entriesResponse.json();
        for (const entry of entriesData.data) {
          await indexedDBManager.saveTimeEntry({
            ...entry,
            syncStatus: 'synced',
          });
          result.synced++;
        }
      }

      // Pull projects
      const projectsUrl = lastSync 
        ? `/api/projects?since=${lastSync.toISOString()}`
        : '/api/projects';
      
      const projectsResponse = await fetch(projectsUrl, {
        headers: this.getAuthHeaders(),
      });

      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        for (const project of projectsData.data) {
          await indexedDBManager.saveProject({
            ...project,
            syncStatus: 'synced',
          });
          result.synced++;
        }
      }

    } catch (error) {
      result.errors.push(`Pull server changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private async resolveConflict(type: string, clientData: any, serverData: any): Promise<ConflictResolution> {
    const resolver = this.conflictResolvers.get(type);
    if (resolver) {
      return resolver(clientData, serverData);
    }

    // Default resolution: prefer server data for now
    return { strategy: 'server' };
  }

  private async handleOfflineRequest(request: any): Promise<void> {
    try {
      const url = new URL(request.url);
      const endpoint = url.pathname;
      
      await indexedDBManager.addToOfflineQueue({
        type: this.getOperationType(request.method, endpoint),
        endpoint,
        method: request.method,
        data: request.body ? JSON.parse(request.body) : null,
        maxRetries: 3,
      });

      console.log('Request queued for offline sync:', endpoint);
    } catch (error) {
      console.error('Failed to queue offline request:', error);
    }
  }

  private getOperationType(method: string, endpoint: string): 'create' | 'update' | 'delete' {
    if (method === 'POST') return 'create';
    if (method === 'PUT' || method === 'PATCH') return 'update';
    if (method === 'DELETE') return 'delete';
    return 'update'; // fallback
  }

  private getAuthHeaders(): Record<string, string> {
    // Get auth token from localStorage or wherever it's stored
    const token = localStorage.getItem('authToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Public API methods
  onSync(listener: (result: SyncResult) => void): void {
    this.syncListeners.add(listener);
  }

  offSync(listener: (result: SyncResult) => void): void {
    this.syncListeners.delete(listener);
  }

  private notifySyncListeners(result: SyncResult): void {
    this.syncListeners.forEach(listener => listener(result));
  }

  setConflictResolver(type: string, resolver: (clientData: any, serverData: any) => ConflictResolution): void {
    this.conflictResolvers.set(type, resolver);
  }

  isOnlineStatus(): boolean {
    return this.isOnline;
  }

  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  async requestBackgroundSync(): Promise<void> {
    try {
      await serviceWorkerManager.requestSync('offline-sync');
    } catch (error) {
      console.warn('Background sync not available, falling back to manual sync');
      // Fallback to immediate sync
      setTimeout(() => this.triggerSync(), 1000);
    }
  }
}

// Create singleton instance
export const syncManager = new SyncManager();

// Utility functions
export const triggerSync = () => syncManager.triggerSync();
export const onSync = (listener: (result: SyncResult) => void) => syncManager.onSync(listener);
export const offSync = (listener: (result: SyncResult) => void) => syncManager.offSync(listener);