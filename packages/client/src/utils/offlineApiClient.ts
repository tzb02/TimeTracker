// Offline-aware API client that handles network failures gracefully

import { indexedDBManager, TimeEntry, Project } from './indexedDB';
import { syncManager } from './syncManager';

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  offline?: boolean;
  queued?: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

class OfflineApiClient {
  private baseURL: string;
  private authToken: string | null = null;

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
    this.loadAuthToken();
  }

  private loadAuthToken(): void {
    this.authToken = localStorage.getItem('authToken');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Always check for fresh token
    const token = this.authToken || localStorage.getItem('authToken');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data: data.data || data,
        success: true,
      };
    } catch (error) {
      console.warn(`API request failed for ${endpoint}:`, error);
      
      // If offline, try to handle gracefully
      if (!navigator.onLine || error instanceof TypeError) {
        return this.handleOfflineRequest<T>(endpoint, options);
      }
      
      throw error;
    }
  }

  private async handleOfflineRequest<T>(
    endpoint: string,
    options: RequestInit
  ): Promise<ApiResponse<T>> {
    const method = options.method || 'GET';
    
    // For GET requests, try to return cached data
    if (method === 'GET') {
      return this.handleOfflineGet<T>(endpoint);
    }
    
    // For mutations, queue the request
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      await this.queueOfflineRequest(endpoint, options);
      return {
        data: null as any,
        success: false,
        offline: true,
        queued: true,
        message: 'Request queued for sync when online',
      };
    }
    
    throw new Error('Cannot handle offline request');
  }

  private async handleOfflineGet<T>(endpoint: string): Promise<ApiResponse<T>> {
    // Try to get data from IndexedDB based on endpoint
    if (endpoint.includes('/entries')) {
      const userId = this.getCurrentUserId();
      if (userId) {
        const entries = await indexedDBManager.getTimeEntries(userId);
        return {
          data: { data: entries, pagination: { total: entries.length, page: 1, limit: 50, totalPages: 1 } } as any,
          success: true,
          offline: true,
        };
      }
    }
    
    if (endpoint.includes('/projects')) {
      const userId = this.getCurrentUserId();
      if (userId) {
        const projects = await indexedDBManager.getProjects(userId);
        return {
          data: projects as any,
          success: true,
          offline: true,
        };
      }
    }
    
    if (endpoint.includes('/timers/active')) {
      // Return null for active timer when offline
      return {
        data: null as any,
        success: true,
        offline: true,
      };
    }
    
    throw new Error('No offline data available');
  }

  private async queueOfflineRequest(endpoint: string, options: RequestInit): Promise<void> {
    const method = options.method as 'POST' | 'PUT' | 'DELETE';
    const data = options.body ? JSON.parse(options.body as string) : null;
    
    await indexedDBManager.addToOfflineQueue({
      type: method === 'POST' ? 'create' : method === 'PUT' ? 'update' : 'delete',
      endpoint,
      method,
      data,
      maxRetries: 3,
    });
  }

  private getCurrentUserId(): string | null {
    // Get current user ID from localStorage or app state
    const userStr = localStorage.getItem('time-tracker-store');
    if (userStr) {
      try {
        const store = JSON.parse(userStr);
        return store.state?.user?.id || null;
      } catch {
        return null;
      }
    }
    return null;
  }

  // Time Entries API
  async getTimeEntries(params?: {
    page?: number;
    limit?: number;
    projectId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<PaginatedResponse<TimeEntry>>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.projectId) queryParams.set('projectId', params.projectId);
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);
    
    const endpoint = `/entries${queryParams.toString() ? `?${queryParams}` : ''}`;
    return this.makeRequest<PaginatedResponse<TimeEntry>>(endpoint);
  }

  async createTimeEntry(data: Partial<TimeEntry>): Promise<ApiResponse<TimeEntry>> {
    // Save locally first for offline support
    if (!navigator.onLine) {
      const localEntry: TimeEntry = {
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: this.getCurrentUserId() || '',
        projectId: data.projectId || '',
        description: data.description || '',
        startTime: data.startTime || new Date(),
        endTime: data.endTime,
        duration: data.duration || 0,
        isRunning: data.isRunning || false,
        tags: data.tags || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        localId: `local_${Date.now()}`,
        syncStatus: 'pending',
        lastModified: new Date(),
      };
      
      await indexedDBManager.saveTimeEntry(localEntry);
      
      return {
        data: localEntry,
        success: true,
        offline: true,
        message: 'Entry saved locally, will sync when online',
      };
    }

    return this.makeRequest<TimeEntry>('/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTimeEntry(id: string, data: Partial<TimeEntry>): Promise<ApiResponse<TimeEntry>> {
    // Update locally first for offline support
    if (!navigator.onLine) {
      const existingEntry = await indexedDBManager.getTimeEntry(id);
      if (existingEntry) {
        const updatedEntry = {
          ...existingEntry,
          ...data,
          updatedAt: new Date(),
          syncStatus: 'pending' as const,
          lastModified: new Date(),
        };
        
        await indexedDBManager.saveTimeEntry(updatedEntry);
        
        return {
          data: updatedEntry,
          success: true,
          offline: true,
          message: 'Entry updated locally, will sync when online',
        };
      }
    }

    return this.makeRequest<TimeEntry>(`/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTimeEntry(id: string): Promise<ApiResponse<void>> {
    // Mark as deleted locally for offline support
    if (!navigator.onLine) {
      await indexedDBManager.deleteTimeEntry(id);
      
      return {
        data: undefined as any,
        success: true,
        offline: true,
        message: 'Entry deleted locally, will sync when online',
      };
    }

    return this.makeRequest<void>(`/entries/${id}`, {
      method: 'DELETE',
    });
  }

  // Projects API
  async getProjects(): Promise<ApiResponse<Project[]>> {
    return this.makeRequest<Project[]>('/projects');
  }

  async createProject(data: Partial<Project>): Promise<ApiResponse<Project>> {
    // Save locally first for offline support
    if (!navigator.onLine) {
      const localProject: Project = {
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: data.name || '',
        color: data.color || '#3b82f6',
        description: data.description,
        userId: this.getCurrentUserId() || '',
        isActive: data.isActive !== false,
        createdAt: new Date(),
        updatedAt: new Date(),
        localId: `local_${Date.now()}`,
        syncStatus: 'pending',
        lastModified: new Date(),
      };
      
      await indexedDBManager.saveProject(localProject);
      
      return {
        data: localProject,
        success: true,
        offline: true,
        message: 'Project saved locally, will sync when online',
      };
    }

    return this.makeRequest<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: Partial<Project>): Promise<ApiResponse<Project>> {
    // Update locally first for offline support
    if (!navigator.onLine) {
      const existingProject = await indexedDBManager.getProject(id);
      if (existingProject) {
        const updatedProject = {
          ...existingProject,
          ...data,
          updatedAt: new Date(),
          syncStatus: 'pending' as const,
          lastModified: new Date(),
        };
        
        await indexedDBManager.saveProject(updatedProject);
        
        return {
          data: updatedProject,
          success: true,
          offline: true,
          message: 'Project updated locally, will sync when online',
        };
      }
    }

    return this.makeRequest<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string): Promise<ApiResponse<void>> {
    // Mark as deleted locally for offline support
    if (!navigator.onLine) {
      await indexedDBManager.deleteProject(id);
      
      return {
        data: undefined as any,
        success: true,
        offline: true,
        message: 'Project deleted locally, will sync when online',
      };
    }

    return this.makeRequest<void>(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // Timer API
  async getActiveTimer(): Promise<ApiResponse<TimeEntry | null>> {
    return this.makeRequest<TimeEntry | null>('/timers/active');
  }

  async startTimer(data: { projectId?: string; description?: string }): Promise<ApiResponse<TimeEntry>> {
    return this.makeRequest<TimeEntry>('/timers/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async stopTimer(): Promise<ApiResponse<TimeEntry>> {
    return this.makeRequest<TimeEntry>('/timers/stop', {
      method: 'POST',
    });
  }

  // Auth methods
  setAuthToken(token: string): void {
    this.authToken = token;
    localStorage.setItem('authToken', token);
  }

  clearAuthToken(): void {
    this.authToken = null;
    localStorage.removeItem('authToken');
  }
}

// Create singleton instance
export const offlineApiClient = new OfflineApiClient();