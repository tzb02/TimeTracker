// IndexedDB utilities for offline data storage

export interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  description: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  isRunning: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  // Offline-specific fields
  localId?: string;
  syncStatus: 'synced' | 'pending' | 'conflict';
  lastModified: Date;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  description?: string;
  userId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Offline-specific fields
  localId?: string;
  syncStatus: 'synced' | 'pending' | 'conflict';
  lastModified: Date;
}

export interface OfflineQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  data: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

const DB_NAME = 'TimeTrackerDB';
const DB_VERSION = 1;

// Object store names
const STORES = {
  TIME_ENTRIES: 'timeEntries',
  PROJECTS: 'projects',
  OFFLINE_QUEUE: 'offlineQueue',
  SYNC_METADATA: 'syncMetadata',
} as const;

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.openDatabase();
    return this.initPromise;
  }

  private async openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(db);
      };
    });
  }

  private createObjectStores(db: IDBDatabase): void {
    // Time entries store
    if (!db.objectStoreNames.contains(STORES.TIME_ENTRIES)) {
      const timeEntriesStore = db.createObjectStore(STORES.TIME_ENTRIES, { keyPath: 'id' });
      timeEntriesStore.createIndex('userId', 'userId', { unique: false });
      timeEntriesStore.createIndex('projectId', 'projectId', { unique: false });
      timeEntriesStore.createIndex('syncStatus', 'syncStatus', { unique: false });
      timeEntriesStore.createIndex('lastModified', 'lastModified', { unique: false });
    }

    // Projects store
    if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
      const projectsStore = db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
      projectsStore.createIndex('userId', 'userId', { unique: false });
      projectsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
      projectsStore.createIndex('lastModified', 'lastModified', { unique: false });
    }

    // Offline queue store
    if (!db.objectStoreNames.contains(STORES.OFFLINE_QUEUE)) {
      const queueStore = db.createObjectStore(STORES.OFFLINE_QUEUE, { keyPath: 'id' });
      queueStore.createIndex('timestamp', 'timestamp', { unique: false });
      queueStore.createIndex('type', 'type', { unique: false });
    }

    // Sync metadata store
    if (!db.objectStoreNames.contains(STORES.SYNC_METADATA)) {
      const metadataStore = db.createObjectStore(STORES.SYNC_METADATA, { keyPath: 'key' });
    }
  }

  private ensureDB(): IDBDatabase {
    if (!this.db) {
      throw new Error('IndexedDB not initialized. Call init() first.');
    }
    return this.db;
  }

  // Generic CRUD operations
  async get<T>(storeName: string, key: string): Promise<T | null> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(storeName: string, indexName?: string, query?: IDBValidKey): Promise<T[]> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const source = indexName ? store.index(indexName) : store;
      const request = query ? source.getAll(query) : source.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put<T>(storeName: string, data: T): Promise<void> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    const db = this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Time entries operations
  async saveTimeEntry(entry: TimeEntry): Promise<void> {
    const entryWithMeta = {
      ...entry,
      lastModified: new Date(),
      syncStatus: entry.syncStatus || 'pending' as const,
    };
    return this.put(STORES.TIME_ENTRIES, entryWithMeta);
  }

  async getTimeEntries(userId: string): Promise<TimeEntry[]> {
    return this.getAll<TimeEntry>(STORES.TIME_ENTRIES, 'userId', userId);
  }

  async getTimeEntry(id: string): Promise<TimeEntry | null> {
    return this.get<TimeEntry>(STORES.TIME_ENTRIES, id);
  }

  async deleteTimeEntry(id: string): Promise<void> {
    return this.delete(STORES.TIME_ENTRIES, id);
  }

  async getPendingTimeEntries(): Promise<TimeEntry[]> {
    return this.getAll<TimeEntry>(STORES.TIME_ENTRIES, 'syncStatus', 'pending');
  }

  // Projects operations
  async saveProject(project: Project): Promise<void> {
    const projectWithMeta = {
      ...project,
      lastModified: new Date(),
      syncStatus: project.syncStatus || 'pending' as const,
    };
    return this.put(STORES.PROJECTS, projectWithMeta);
  }

  async getProjects(userId: string): Promise<Project[]> {
    return this.getAll<Project>(STORES.PROJECTS, 'userId', userId);
  }

  async getProject(id: string): Promise<Project | null> {
    return this.get<Project>(STORES.PROJECTS, id);
  }

  async deleteProject(id: string): Promise<void> {
    return this.delete(STORES.PROJECTS, id);
  }

  async getPendingProjects(): Promise<Project[]> {
    return this.getAll<Project>(STORES.PROJECTS, 'syncStatus', 'pending');
  }

  // Offline queue operations
  async addToOfflineQueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const queueItem: OfflineQueueItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: item.maxRetries || 3,
    };
    
    await this.put(STORES.OFFLINE_QUEUE, queueItem);
    return queueItem.id;
  }

  async getOfflineQueue(): Promise<OfflineQueueItem[]> {
    const items = await this.getAll<OfflineQueueItem>(STORES.OFFLINE_QUEUE);
    return items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async removeFromOfflineQueue(id: string): Promise<void> {
    return this.delete(STORES.OFFLINE_QUEUE, id);
  }

  async updateOfflineQueueItem(item: OfflineQueueItem): Promise<void> {
    return this.put(STORES.OFFLINE_QUEUE, item);
  }

  async clearOfflineQueue(): Promise<void> {
    return this.clear(STORES.OFFLINE_QUEUE);
  }

  // Sync metadata operations
  async setSyncMetadata(key: string, value: any): Promise<void> {
    return this.put(STORES.SYNC_METADATA, { key, value, timestamp: new Date() });
  }

  async getSyncMetadata(key: string): Promise<any> {
    const result = await this.get<{ key: string; value: any; timestamp: Date }>(STORES.SYNC_METADATA, key);
    return result?.value || null;
  }

  async getLastSyncTime(): Promise<Date | null> {
    const timestamp = await this.getSyncMetadata('lastSyncTime');
    return timestamp ? new Date(timestamp) : null;
  }

  async setLastSyncTime(timestamp: Date): Promise<void> {
    return this.setSyncMetadata('lastSyncTime', timestamp.toISOString());
  }

  // Utility methods
  async getStorageUsage(): Promise<{ used: number; quota: number }> {
    if ('storage' in navigator && navigator.storage && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { used: 0, quota: 0 };
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

// Create singleton instance
export const indexedDBManager = new IndexedDBManager();

// Utility functions
export const initIndexedDB = () => indexedDBManager.init();
export const closeIndexedDB = () => indexedDBManager.close();