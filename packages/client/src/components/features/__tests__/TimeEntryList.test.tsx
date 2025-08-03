import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { TimeEntryList } from '../TimeEntryList';
import * as api from '../../../lib/api';

// Mock the API
vi.mock('../../../lib/api');
const mockApi = api as any;

// Mock the time utilities
vi.mock('../../../utils/time', () => ({
  formatDuration: (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`,
  formatTime: (date: string) => new Date(date).toLocaleTimeString(),
  formatDate: (date: string) => new Date(date).toLocaleDateString(),
  getRelativeDate: (date: string) => {
    const d = new Date(date);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    return d.toLocaleDateString();
  },
}));

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('TimeEntryList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockApi.timeEntryApi = {
      getAll: vi.fn().mockReturnValue(new Promise(() => {})), // Never resolves
    };
    mockApi.projectApi = {
      getAll: vi.fn().mockResolvedValue({ projects: [], count: 0 }),
    };

    renderWithQueryClient(<TimeEntryList />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders empty state when no entries', async () => {
    mockApi.timeEntryApi = {
      getAll: vi.fn().mockResolvedValue({
        entries: [],
        total: 0,
        hasMore: false,
      }),
    };
    mockApi.projectApi = {
      getAll: vi.fn().mockResolvedValue({ projects: [], count: 0 }),
    };

    renderWithQueryClient(<TimeEntryList />);
    
    await waitFor(() => {
      expect(screen.getByText('No time entries found')).toBeInTheDocument();
    });
  });

  it('renders time entries when data is available', async () => {
    const mockEntries = [
      {
        id: '1',
        userId: 'user1',
        projectId: 'project1',
        description: 'Test task',
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T11:00:00Z',
        duration: 3600,
        isRunning: false,
        tags: [],
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T11:00:00Z',
        project: {
          id: 'project1',
          name: 'Test Project',
          color: '#3B82F6',
          userId: 'user1',
          isActive: true,
          createdAt: '2024-01-01T09:00:00Z',
          updatedAt: '2024-01-01T09:00:00Z',
        },
      },
    ];

    mockApi.timeEntryApi = {
      getAll: vi.fn().mockResolvedValue({
        entries: mockEntries,
        total: 1,
        hasMore: false,
      }),
    };
    mockApi.projectApi = {
      getAll: vi.fn().mockResolvedValue({ projects: [], count: 0 }),
    };

    renderWithQueryClient(<TimeEntryList />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
      expect(screen.getByText('Test task')).toBeInTheDocument();
    });
  });

  it('shows keyboard shortcuts help when entries are available', async () => {
    const mockEntries = [
      {
        id: '1',
        userId: 'user1',
        projectId: 'project1',
        description: 'Test task',
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T11:00:00Z',
        duration: 3600,
        isRunning: false,
        tags: [],
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T11:00:00Z',
        project: {
          id: 'project1',
          name: 'Test Project',
          color: '#3B82F6',
          userId: 'user1',
          isActive: true,
          createdAt: '2024-01-01T09:00:00Z',
          updatedAt: '2024-01-01T09:00:00Z',
        },
      },
    ];

    mockApi.timeEntryApi = {
      getAll: vi.fn().mockResolvedValue({
        entries: mockEntries,
        total: 1,
        hasMore: false,
      }),
    };
    mockApi.projectApi = {
      getAll: vi.fn().mockResolvedValue({ projects: [], count: 0 }),
    };

    renderWithQueryClient(<TimeEntryList />);
    
    await waitFor(() => {
      expect(screen.getByText(/Shortcuts:/)).toBeInTheDocument();
      expect(screen.getByText('Ctrl+A')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+U')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+D')).toBeInTheDocument();
    });
  });
});