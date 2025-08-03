import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { offlineApiClient } from '../offlineApiClient';
import { indexedDBManager } from '../indexedDB';

// Mock dependencies
vi.mock('../indexedDB');

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

describe('Offline API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigator.onLine = true;
    mockLocalStorage.getItem.mockReturnValue('mock-auth-token');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should set auth token', () => {
      offlineApiClient.setAuthToken('new-token');
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('authToken', 'new-token');
    });

    it('should clear auth token', () => {
      offlineApiClient.clearAuthToken();
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
    });

    it('should include auth header in requests', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      await offlineApiClient.getTimeEntries();

      expect(fetch).toHaveBeenCalledWith(
        '/api/entries',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-auth-token',
          }),
        })
      );
    });
  });

  describe('Online Requests', () => {
    it('should make successful API requests when online', async () => {
      const mockData = [{ id: '1', description: 'Test entry' }];
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockData }),
      } as Response);

      const result = await offlineApiClient.getTimeEntries();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(result.offline).toBeUndefined();
    });

    it('should handle API errors when online', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(offlineApiClient.getTimeEntries()).rejects.toThrow('HTTP 500: Internal Server Error');
    });
  });

  describe('Offline Handling', () => {
    beforeEach(() => {
      navigator.onLine = false;
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'time-tracker-store') {
          return JSON.stringify({
            state: { user: { id: 'user-123' } }
          });
        }
        if (key === 'authToken') {
          return 'mock-auth-token';
        }
        return null;
      });
    });

    it('should return cached time entries when offline', async () => {
      const mockEntries = [
        { id: 'entry-1', description: 'Cached entry', userId: 'user-123' },
      ];
      vi.mocked(indexedDBManager.getTimeEntries).mockResolvedValue(mockEntries as any);

      const result = await offlineApiClient.getTimeEntries();

      expect(result.success).toBe(true);
      expect(result.offline).toBe(true);
      expect(result.data.data).toEqual(mockEntries);
      expect(indexedDBManager.getTimeEntries).toHaveBeenCalledWith('user-123');
    });

    it('should return cached projects when offline', async () => {
      const mockProjects = [
        { id: 'project-1', name: 'Cached project', userId: 'user-123' },
      ];
      vi.mocked(indexedDBManager.getProjects).mockResolvedValue(mockProjects as any);

      const result = await offlineApiClient.getProjects();

      expect(result.success).toBe(true);
      expect(result.offline).toBe(true);
      expect(result.data).toEqual(mockProjects);
      expect(indexedDBManager.getProjects).toHaveBeenCalledWith('user-123');
    });

    it('should return null for active timer when offline', async () => {
      const result = await offlineApiClient.getActiveTimer();

      expect(result.success).toBe(true);
      expect(result.offline).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should save time entry locally when offline', async () => {
      vi.mocked(indexedDBManager.saveTimeEntry).mockResolvedValue();

      const entryData = {
        projectId: 'project-1',
        description: 'Offline entry',
        startTime: new Date(),
        duration: 3600,
      };

      const result = await offlineApiClient.createTimeEntry(entryData);

      expect(result.success).toBe(true);
      expect(result.offline).toBe(true);
      expect(result.message).toContain('saved locally');
      expect(indexedDBManager.saveTimeEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          description: 'Offline entry',
          syncStatus: 'pending',
          localId: expect.stringMatching(/^local_/),
        })
      );
    });

    it('should update time entry locally when offline', async () => {
      const existingEntry = {
        id: 'entry-1',
        description: 'Original entry',
        projectId: 'project-1',
        userId: 'user-123',
      };
      vi.mocked(indexedDBManager.getTimeEntry).mockResolvedValue(existingEntry as any);
      vi.mocked(indexedDBManager.saveTimeEntry).mockResolvedValue();

      const updateData = { description: 'Updated entry' };
      const result = await offlineApiClient.updateTimeEntry('entry-1', updateData);

      expect(result.success).toBe(true);
      expect(result.offline).toBe(true);
      expect(result.message).toContain('updated locally');
      expect(indexedDBManager.saveTimeEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'entry-1',
          description: 'Updated entry',
          syncStatus: 'pending',
        })
      );
    });

    it('should delete time entry locally when offline', async () => {
      vi.mocked(indexedDBManager.deleteTimeEntry).mockResolvedValue();

      const result = await offlineApiClient.deleteTimeEntry('entry-1');

      expect(result.success).toBe(true);
      expect(result.offline).toBe(true);
      expect(result.message).toContain('deleted locally');
      expect(indexedDBManager.deleteTimeEntry).toHaveBeenCalledWith('entry-1');
    });

    it('should save project locally when offline', async () => {
      vi.mocked(indexedDBManager.saveProject).mockResolvedValue();

      const projectData = {
        name: 'Offline Project',
        color: '#3b82f6',
        description: 'Created offline',
      };

      const result = await offlineApiClient.createProject(projectData);

      expect(result.success).toBe(true);
      expect(result.offline).toBe(true);
      expect(result.message).toContain('saved locally');
      expect(indexedDBManager.saveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Offline Project',
          color: '#3b82f6',
          syncStatus: 'pending',
          localId: expect.stringMatching(/^local_/),
        })
      );
    });
  });

  describe('Network Failure Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      vi.mocked(fetch).mockRejectedValue(new TypeError('Network request failed'));
      
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'time-tracker-store') {
          return JSON.stringify({
            state: { user: { id: 'user-123' } }
          });
        }
        return null;
      });

      vi.mocked(indexedDBManager.getTimeEntries).mockResolvedValue([]);

      const result = await offlineApiClient.getTimeEntries();

      expect(result.success).toBe(true);
      expect(result.offline).toBe(true);
    });

    it('should queue mutations when network fails', async () => {
      // Mock network error
      vi.mocked(fetch).mockRejectedValue(new TypeError('Network request failed'));
      vi.mocked(indexedDBManager.addToOfflineQueue).mockResolvedValue('queue-id-123');

      const entryData = { description: 'Test entry' };
      
      // This should trigger the offline handling path
      navigator.onLine = false;
      const result = await offlineApiClient.createTimeEntry(entryData);

      expect(result.offline).toBe(true);
    });
  });

  describe('Query Parameters', () => {
    it('should handle query parameters correctly', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      await offlineApiClient.getTimeEntries({
        page: 2,
        limit: 25,
        projectId: 'project-1',
        startDate: '2023-01-01',
        endDate: '2023-01-31',
      });

      expect(fetch).toHaveBeenCalledWith(
        '/api/entries?page=2&limit=25&projectId=project-1&startDate=2023-01-01&endDate=2023-01-31',
        expect.any(Object)
      );
    });

    it('should handle empty query parameters', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as Response);

      await offlineApiClient.getTimeEntries();

      expect(fetch).toHaveBeenCalledWith('/api/entries', expect.any(Object));
    });
  });

  describe('Timer Operations', () => {
    it('should start timer with project and description', async () => {
      const mockTimer = { id: 'timer-1', isRunning: true };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockTimer }),
      } as Response);

      const result = await offlineApiClient.startTimer({
        projectId: 'project-1',
        description: 'Working on feature',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTimer);
      expect(fetch).toHaveBeenCalledWith(
        '/api/timers/start',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            projectId: 'project-1',
            description: 'Working on feature',
          }),
        })
      );
    });

    it('should stop timer', async () => {
      const mockTimer = { id: 'timer-1', isRunning: false };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockTimer }),
      } as Response);

      const result = await offlineApiClient.stopTimer();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTimer);
      expect(fetch).toHaveBeenCalledWith(
        '/api/timers/stop',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });
});