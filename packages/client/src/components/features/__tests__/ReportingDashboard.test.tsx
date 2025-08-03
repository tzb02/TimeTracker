import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { ReportingDashboard } from '../ReportingDashboard';
import { AuthProvider } from '../../../contexts/AuthContext';
import * as api from '../../../lib/api';

// Mock the API
vi.mock('../../../lib/api', () => ({
  reportApi: {
    getTimeReport: vi.fn(),
    exportData: vi.fn(),
  },
  projectApi: {
    getAll: vi.fn(),
  },
}));

const mockReportApi = api.reportApi as any;
const mockProjectApi = api.projectApi as any;

// Mock AuthContext
const mockUser = {
  id: 'user1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user' as const,
  preferences: {
    timeFormat: '24h' as const,
    weekStartDay: 1,
    notifications: true,
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    login: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
  }),
}));

const mockReportData = {
  summary: {
    totalTime: 28800, // 8 hours
    totalEntries: 15,
    averageSessionTime: 1920, // 32 minutes
    mostProductiveDay: 'Monday',
    mostUsedProject: 'Development',
  },
  breakdown: {
    byProject: [
      {
        projectId: '1',
        projectName: 'Development',
        projectColor: '#3B82F6',
        totalTime: 18000,
        entryCount: 10,
        percentage: 62.5,
      },
      {
        projectId: '2',
        projectName: 'Design',
        projectColor: '#EF4444',
        totalTime: 10800,
        entryCount: 5,
        percentage: 37.5,
      },
    ],
    byDay: [
      {
        date: '2024-01-01',
        totalTime: 7200,
        entryCount: 3,
        projects: [
          {
            projectId: '1',
            projectName: 'Development',
            time: 7200,
          },
        ],
      },
      {
        date: '2024-01-02',
        totalTime: 10800,
        entryCount: 5,
        projects: [
          {
            projectId: '1',
            projectName: 'Development',
            time: 5400,
          },
          {
            projectId: '2',
            projectName: 'Design',
            time: 5400,
          },
        ],
      },
    ],
  },
  trends: {
    dailyAverage: 3600,
    weeklyTrend: 'up' as const,
    productivityScore: 85.5,
  },
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('ReportingDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReportApi.getTimeReport.mockResolvedValue(mockReportData);
    mockProjectApi.getAll.mockResolvedValue({
      projects: [
        {
          id: '1',
          name: 'Development',
          color: '#3B82F6',
          userId: 'user1',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
      count: 1,
    });
  });

  it('renders dashboard header', async () => {
    render(<ReportingDashboard />, { wrapper: createWrapper() });

    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Analyze your time tracking data and export reports')).toBeInTheDocument();
  });

  it('renders filters component', async () => {
    render(<ReportingDashboard />, { wrapper: createWrapper() });

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('Apply Filters')).toBeInTheDocument();
  });

  it('renders export buttons', async () => {
    render(<ReportingDashboard />, { wrapper: createWrapper() });

    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText('Export PDF')).toBeInTheDocument();
  });

  it('loads and displays report data', async () => {
    render(<ReportingDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockReportApi.getTimeReport).toHaveBeenCalledWith({});
    });

    await waitFor(() => {
      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText('8h 0m')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
    });
  });

  it('displays project breakdown chart', async () => {
    render(<ReportingDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Time by Project')).toBeInTheDocument();
    });
  });

  it('displays daily activity chart', async () => {
    render(<ReportingDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Daily Activity (Last 7 Days)')).toBeInTheDocument();
    });
  });

  it('displays project details table', async () => {
    render(<ReportingDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Project Details')).toBeInTheDocument();
      expect(screen.getByText('Development')).toBeInTheDocument();
      expect(screen.getByText('Design')).toBeInTheDocument();
    });
  });

  it('displays daily breakdown table', async () => {
    render(<ReportingDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Daily Breakdown')).toBeInTheDocument();
    });
  });

  it('displays trends section', async () => {
    render(<ReportingDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Trends')).toBeInTheDocument();
      expect(screen.getByText('Daily Average')).toBeInTheDocument();
      expect(screen.getByText('Weekly Trend')).toBeInTheDocument();
      expect(screen.getByText('Productivity Score')).toBeInTheDocument();
      expect(screen.getByText('85.5%')).toBeInTheDocument();
    });
  });

  it('applies filters when apply button is clicked', async () => {
    render(<ReportingDashboard />, { wrapper: createWrapper() });

    // Wait for initial load
    await waitFor(() => {
      expect(mockReportApi.getTimeReport).toHaveBeenCalledWith({});
    });

    // Click apply filters
    fireEvent.click(screen.getByText('Apply Filters'));

    await waitFor(() => {
      expect(mockReportApi.getTimeReport).toHaveBeenCalledTimes(2);
    });
  });

  it('shows empty state when no data', async () => {
    const emptyReportData = {
      ...mockReportData,
      summary: {
        ...mockReportData.summary,
        totalEntries: 0,
        totalTime: 0,
      },
      breakdown: {
        byProject: [],
        byDay: [],
      },
    };

    mockReportApi.getTimeReport.mockResolvedValue(emptyReportData);

    render(<ReportingDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No data found')).toBeInTheDocument();
      expect(screen.getByText('No time entries found for the selected filters. Try adjusting your date range or clearing filters.')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    mockReportApi.getTimeReport.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<ReportingDashboard />, { wrapper: createWrapper() });

    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
  });

  it('shows error state and retry button', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockReportApi.getTimeReport.mockRejectedValue(new Error('API Error'));

    render(<ReportingDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Error loading report')).toBeInTheDocument();
      expect(screen.getByText('Failed to load reporting data. Please try again.')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });
});