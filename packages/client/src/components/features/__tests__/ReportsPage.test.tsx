import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportsPage } from '../ReportsPage';
import { useReportStore } from '../../../store/useReportStore';

// Mock stores
jest.mock('../../../store/useReportStore');

const mockUseReportStore = useReportStore as jest.MockedFunction<typeof useReportStore>;

describe('ReportsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockUseReportStore.mockReturnValue({
      reportData: {
        totalTime: 7200, // 2 hours
        projectBreakdown: [
          { projectId: '1', projectName: 'Project 1', totalTime: 3600, color: '#3B82F6' },
          { projectId: '2', projectName: 'Project 2', totalTime: 3600, color: '#EF4444' },
        ],
        dailyBreakdown: [
          { date: '2024-01-01', totalTime: 3600 },
          { date: '2024-01-02', totalTime: 3600 },
        ],
      },
      isLoading: false,
      error: null,
      dateRange: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
      },
      setDateRange: jest.fn(),
      generateReport: jest.fn(),
      exportReport: jest.fn(),
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('renders report summary', () => {
    renderWithProviders(<ReportsPage />);

    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('2h 0m')).toBeInTheDocument(); // Total time
    expect(screen.getByText('Project 1')).toBeInTheDocument();
    expect(screen.getByText('Project 2')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUseReportStore.mockReturnValue({
      reportData: null,
      isLoading: true,
      error: null,
      dateRange: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
      },
      setDateRange: jest.fn(),
      generateReport: jest.fn(),
      exportReport: jest.fn(),
    });

    renderWithProviders(<ReportsPage />);

    expect(screen.getByText('Loading report...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUseReportStore.mockReturnValue({
      reportData: null,
      isLoading: false,
      error: 'Failed to generate report',
      dateRange: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
      },
      setDateRange: jest.fn(),
      generateReport: jest.fn(),
      exportReport: jest.fn(),
    });

    renderWithProviders(<ReportsPage />);

    expect(screen.getByText('Failed to generate report')).toBeInTheDocument();
  });

  it('allows changing date range', async () => {
    const mockSetDateRange = jest.fn();
    const mockGenerateReport = jest.fn();
    
    mockUseReportStore.mockReturnValue({
      reportData: null,
      isLoading: false,
      error: null,
      dateRange: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
      },
      setDateRange: mockSetDateRange,
      generateReport: mockGenerateReport,
      exportReport: jest.fn(),
    });

    renderWithProviders(<ReportsPage />);

    // Change start date
    const startDateInput = screen.getByLabelText(/start date/i);
    fireEvent.change(startDateInput, { target: { value: '2024-01-15' } });

    // Generate report
    fireEvent.click(screen.getByRole('button', { name: /generate report/i }));

    await waitFor(() => {
      expect(mockSetDateRange).toHaveBeenCalled();
      expect(mockGenerateReport).toHaveBeenCalled();
    });
  });

  it('allows exporting report', async () => {
    const mockExportReport = jest.fn();
    
    mockUseReportStore.mockReturnValue({
      reportData: {
        totalTime: 7200,
        projectBreakdown: [],
        dailyBreakdown: [],
      },
      isLoading: false,
      error: null,
      dateRange: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
      },
      setDateRange: jest.fn(),
      generateReport: jest.fn(),
      exportReport: mockExportReport,
    });

    renderWithProviders(<ReportsPage />);

    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));

    await waitFor(() => {
      expect(mockExportReport).toHaveBeenCalledWith('csv');
    });
  });
});