import axios, { AxiosInstance, AxiosError } from 'axios';

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
let accessToken: string | null = null;
let refreshToken: string | null = null;

export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  delete api.defaults.headers.common['Authorization'];
};

export const getTokens = () => ({
  accessToken,
  refreshToken,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && refreshToken && originalRequest) {
      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;
        setTokens(newAccessToken, newRefreshToken);

        // Retry the original request
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API error types
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: {
      conflictingEntry?: TimeEntry;
      [key: string]: any;
    };
  };
}

export const isApiError = (error: unknown): error is AxiosError<ApiError> => {
  return axios.isAxiosError(error) && error.response?.data?.error !== undefined;
};

// Auth API types
export interface User {
  id: string;
  email: string;
  name: string;
  organizationId?: string;
  role: 'admin' | 'user';
  preferences: {
    defaultProject?: string;
    timeFormat: '12h' | '24h';
    weekStartDay: number;
    notifications: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
  organizationId?: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

// Auth API functions
export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  logout: async (refreshTokenId?: string): Promise<void> => {
    await api.post('/auth/logout', { refreshTokenId });
  },

  logoutAll: async (userId: string): Promise<void> => {
    await api.post('/auth/logout-all', { userId });
  },

  refreshToken: async (token: string): Promise<{ accessToken: string; refreshToken: string }> => {
    const response = await api.post('/auth/refresh', { refreshToken: token });
    return response.data;
  },

  getMe: async (): Promise<{ user: User }> => {
    const response = await api.get<{ user: User }>('/auth/me');
    return response.data;
  },

  updatePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.put('/auth/password', { currentPassword, newPassword });
  },
};

// Timer API types
export interface Project {
  id: string;
  name: string;
  color: string;
  description?: string;
  userId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  description: string;
  startTime: string;
  endTime?: string;
  duration: number;
  isRunning: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TimerState {
  isRunning: boolean;
  currentEntry?: TimeEntry;
  startTime?: string;
  elapsedTime: number;
  lastSync: string;
}

export interface StartTimerRequest {
  projectId: string;
  description?: string;
}

export interface StopTimerRequest {
  endTime?: string;
}

// Timer API functions
export const timerApi = {
  start: async (data: StartTimerRequest): Promise<{ timeEntry: TimeEntry; message: string }> => {
    const response = await api.post<{ success: boolean; data: { timeEntry: TimeEntry; message: string } }>('/timers/start', data);
    return response.data.data;
  },

  stop: async (data?: StopTimerRequest): Promise<{ timeEntry: TimeEntry; message: string }> => {
    const response = await api.post<{ success: boolean; data: { timeEntry: TimeEntry; message: string } }>('/timers/stop', data || {});
    return response.data.data;
  },

  pause: async (): Promise<{ timeEntry: TimeEntry; message: string }> => {
    const response = await api.post<{ success: boolean; data: { timeEntry: TimeEntry; message: string } }>('/timers/pause', {});
    return response.data.data;
  },

  getActive: async (): Promise<{ activeTimer: TimeEntry | null; hasActiveTimer: boolean }> => {
    const response = await api.get<{ success: boolean; data: { activeTimer: TimeEntry | null; hasActiveTimer: boolean } }>('/timers/active');
    return response.data.data;
  },

  getState: async (): Promise<TimerState> => {
    const response = await api.get<{ success: boolean; data: TimerState }>('/timers/state');
    return response.data.data;
  },

  resolveConflict: async (action: 'stop_existing' | 'cancel_new'): Promise<{ message: string }> => {
    const response = await api.post<{ success: boolean; data: { message: string } }>('/timers/resolve-conflict', { action });
    return response.data.data;
  },

  forceStopAll: async (): Promise<{ stoppedTimers: TimeEntry[]; count: number; message: string }> => {
    const response = await api.post<{ success: boolean; data: { stoppedTimers: TimeEntry[]; count: number; message: string } }>('/timers/force-stop-all');
    return response.data.data;
  },

  validate: async (): Promise<{ isValid: boolean; issues: string[] }> => {
    const response = await api.get<{ success: boolean; data: { isValid: boolean; issues: string[] } }>('/timers/validate');
    return response.data.data;
  },
};

// Project API types
export interface CreateProjectRequest {
  name: string;
  color?: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  color?: string;
  description?: string;
  isActive?: boolean;
}

export interface ProjectWithStats extends Project {
  totalTime: number;
  entryCount: number;
}

// Project API functions
export const projectApi = {
  getAll: async (options?: { includeInactive?: boolean; withStats?: boolean; search?: string }): Promise<{ projects: Project[] | ProjectWithStats[]; count: number }> => {
    const params = new URLSearchParams();
    if (options?.includeInactive) params.append('includeInactive', 'true');
    if (options?.withStats) params.append('withStats', 'true');
    if (options?.search) params.append('search', options.search);
    
    const response = await api.get<{ success: boolean; data: { projects: Project[] | ProjectWithStats[]; count: number } }>(`/projects?${params.toString()}`);
    return response.data.data;
  },

  getById: async (id: string): Promise<{ project: Project }> => {
    const response = await api.get<{ success: boolean; data: { project: Project } }>(`/projects/${id}`);
    return response.data.data;
  },

  create: async (data: CreateProjectRequest): Promise<{ project: Project; message: string }> => {
    const response = await api.post<{ success: boolean; data: { project: Project; message: string } }>('/projects', data);
    return response.data.data;
  },

  update: async (id: string, data: UpdateProjectRequest): Promise<{ project: Project; message: string }> => {
    const response = await api.put<{ success: boolean; data: { project: Project; message: string } }>(`/projects/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete<{ success: boolean; data: { message: string } }>(`/projects/${id}`);
    return response.data.data;
  },

  getUsedColors: async (): Promise<{ colors: string[]; count: number }> => {
    const response = await api.get<{ success: boolean; data: { colors: string[]; count: number } }>('/projects/colors/used');
    return response.data.data;
  },
};

// Time Entry API types
export interface TimeEntryFilters {
  projectId?: string;
  startDate?: Date;
  endDate?: Date;
  isRunning?: boolean;
  tags?: string[];
  search?: string;
}

export interface CreateTimeEntryRequest {
  projectId: string;
  description?: string;
  startTime?: Date;
}

export interface UpdateTimeEntryRequest {
  projectId?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  tags?: string[];
}

export interface BulkUpdateRequest {
  entryIds: string[];
  updates: {
    projectId?: string;
    description?: string;
    tags?: string[];
  };
}

export interface BulkDeleteRequest {
  entryIds: string[];
}

export interface TimeEntryWithProject extends TimeEntry {
  project: Project;
}

// Time Entry API functions
export const timeEntryApi = {
  getAll: async (filters?: TimeEntryFilters, limit = 50, offset = 0): Promise<{ entries: TimeEntryWithProject[]; total: number; hasMore: boolean }> => {
    const params = new URLSearchParams();
    if (filters?.projectId) params.append('projectId', filters.projectId);
    if (filters?.startDate) params.append('startDate', filters.startDate.toISOString());
    if (filters?.endDate) params.append('endDate', filters.endDate.toISOString());
    if (filters?.isRunning !== undefined) params.append('isRunning', filters.isRunning.toString());
    if (filters?.tags) filters.tags.forEach(tag => params.append('tags', tag));
    if (filters?.search) params.append('search', filters.search);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const response = await api.get<{ success: boolean; data: { entries: TimeEntryWithProject[]; total: number; hasMore: boolean } }>(`/entries?${params.toString()}`);
    return response.data.data;
  },

  getById: async (id: string): Promise<{ entry: TimeEntryWithProject }> => {
    const response = await api.get<{ success: boolean; data: { entry: TimeEntryWithProject } }>(`/entries/${id}`);
    return response.data.data;
  },

  create: async (data: CreateTimeEntryRequest): Promise<{ entry: TimeEntry; message: string }> => {
    const response = await api.post<{ success: boolean; data: { entry: TimeEntry; message: string } }>('/entries', data);
    return response.data.data;
  },

  update: async (id: string, data: UpdateTimeEntryRequest): Promise<{ entry: TimeEntry; message: string }> => {
    const response = await api.put<{ success: boolean; data: { entry: TimeEntry; message: string } }>(`/entries/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete<{ success: boolean; data: { message: string } }>(`/entries/${id}`);
    return response.data.data;
  },

  bulkUpdate: async (data: BulkUpdateRequest): Promise<{ entries: TimeEntry[]; count: number; message: string }> => {
    const response = await api.put<{ success: boolean; data: { entries: TimeEntry[]; count: number; message: string } }>('/entries/bulk', data);
    return response.data.data;
  },

  bulkDelete: async (data: BulkDeleteRequest): Promise<{ count: number; message: string }> => {
    const response = await api.delete<{ success: boolean; data: { count: number; message: string } }>('/entries/bulk', { data });
    return response.data.data;
  },

  search: async (query: string, limit = 50, offset = 0): Promise<{ entries: TimeEntryWithProject[]; total: number; hasMore: boolean; searchTerm: string }> => {
    const params = new URLSearchParams();
    params.append('q', query);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const response = await api.get<{ success: boolean; data: { entries: TimeEntryWithProject[]; total: number; hasMore: boolean; searchTerm: string } }>(`/entries/search?${params.toString()}`);
    return response.data.data;
  },
};

// Report API types
export interface ReportFilters {
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  projectIds?: string[];
  tags?: string[];
  groupBy?: 'day' | 'week' | 'month' | 'project' | 'tag';
}

export interface TimeReportData {
  summary: {
    totalTime: number;
    totalEntries: number;
    averageSessionTime: number;
    mostProductiveDay: string;
    mostUsedProject: string;
  };
  breakdown: {
    byProject: Array<{
      projectId: string;
      projectName: string;
      projectColor: string;
      totalTime: number;
      entryCount: number;
      percentage: number;
    }>;
    byDay: Array<{
      date: string;
      totalTime: number;
      entryCount: number;
      projects: Array<{
        projectId: string;
        projectName: string;
        time: number;
      }>;
    }>;
    byWeek?: Array<{
      weekStart: string;
      weekEnd: string;
      totalTime: number;
      entryCount: number;
    }>;
    byMonth?: Array<{
      month: string;
      year: number;
      totalTime: number;
      entryCount: number;
    }>;
  };
  trends: {
    dailyAverage: number;
    weeklyTrend: 'up' | 'down' | 'stable';
    productivityScore: number;
  };
}

export interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  summary: {
    totalTime: number;
    totalEntries: number;
    averagePerDay: number;
    workingDays: number;
  };
  dailyBreakdown: Array<{
    date: string;
    dayName: string;
    totalTime: number;
    entryCount: number;
    projects: Array<{
      projectId: string;
      projectName: string;
      projectColor: string;
      time: number;
    }>;
  }>;
  projectSummary: Array<{
    projectId: string;
    projectName: string;
    projectColor: string;
    totalTime: number;
    entryCount: number;
    percentage: number;
  }>;
}

export interface MonthlyReportData {
  month: number;
  year: number;
  monthName: string;
  summary: {
    totalTime: number;
    totalEntries: number;
    averagePerDay: number;
    workingDays: number;
  };
  weeklyBreakdown: Array<{
    weekNumber: number;
    weekStart: string;
    weekEnd: string;
    totalTime: number;
    entryCount: number;
  }>;
  projectSummary: Array<{
    projectId: string;
    projectName: string;
    projectColor: string;
    totalTime: number;
    entryCount: number;
    percentage: number;
  }>;
}

export interface DashboardSummary {
  today: {
    totalTime: number;
    entryCount: number;
    isTimerRunning: boolean;
    currentProject?: string;
  };
  thisWeek: {
    totalTime: number;
    entryCount: number;
    averagePerDay: number;
    daysWorked: number;
  };
  thisMonth: {
    totalTime: number;
    entryCount: number;
    averagePerDay: number;
    daysWorked: number;
  };
  recentProjects: Array<{
    projectId: string;
    projectName: string;
    projectColor: string;
    lastUsed: string;
    totalTime: number;
  }>;
  topProjects: Array<{
    projectId: string;
    projectName: string;
    projectColor: string;
    totalTime: number;
    percentage: number;
  }>;
}

// Report API functions
export const reportApi = {
  getTimeReport: async (filters?: ReportFilters): Promise<TimeReportData> => {
    const params = new URLSearchParams();
    if (filters?.dateRange) {
      params.append('startDate', filters.dateRange.startDate.toISOString());
      params.append('endDate', filters.dateRange.endDate.toISOString());
    }
    if (filters?.projectIds) {
      filters.projectIds.forEach(id => params.append('projectIds', id));
    }
    if (filters?.tags) {
      filters.tags.forEach(tag => params.append('tags', tag));
    }
    if (filters?.groupBy) {
      params.append('groupBy', filters.groupBy);
    }

    const response = await api.get<{ success: boolean; data: TimeReportData }>(`/reports/time?${params.toString()}`);
    return response.data.data;
  },

  getWeeklyReport: async (weekStart: Date): Promise<WeeklyReportData> => {
    const params = new URLSearchParams();
    params.append('weekStart', weekStart.toISOString());

    const response = await api.get<{ success: boolean; data: WeeklyReportData }>(`/reports/weekly?${params.toString()}`);
    return response.data.data;
  },

  getMonthlyReport: async (month: number, year: number): Promise<MonthlyReportData> => {
    const params = new URLSearchParams();
    params.append('month', month.toString());
    params.append('year', year.toString());

    const response = await api.get<{ success: boolean; data: MonthlyReportData }>(`/reports/monthly?${params.toString()}`);
    return response.data.data;
  },

  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const response = await api.get<{ success: boolean; data: DashboardSummary }>('/reports/dashboard');
    return response.data.data;
  },

  exportData: async (format: 'csv' | 'pdf', filters?: ReportFilters): Promise<Blob> => {
    const params = new URLSearchParams();
    params.append('format', format);
    if (filters?.dateRange) {
      params.append('startDate', filters.dateRange.startDate.toISOString());
      params.append('endDate', filters.dateRange.endDate.toISOString());
    }
    if (filters?.projectIds) {
      filters.projectIds.forEach(id => params.append('projectIds', id));
    }
    if (filters?.tags) {
      filters.tags.forEach(tag => params.append('tags', tag));
    }

    const response = await api.get(`/reports/export?${params.toString()}`, {
      responseType: 'blob'
    });
    return response.data;
  },
};