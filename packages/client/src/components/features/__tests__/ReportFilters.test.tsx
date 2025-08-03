import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { ReportFilters } from '../ReportFilters';
import { ReportFilters as ReportFiltersType } from '../../../lib/api';
import * as api from '../../../lib/api';

// Mock the API
vi.mock('../../../lib/api', () => ({
  projectApi: {
    getAll: vi.fn(),
  },
}));

const mockProjectApi = api.projectApi as any;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('ReportFilters', () => {
  const mockOnFiltersChange = vi.fn();
  const mockOnApplyFilters = vi.fn();
  const mockOnClearFilters = vi.fn();

  const defaultProps = {
    filters: {} as ReportFiltersType,
    onFiltersChange: mockOnFiltersChange,
    onApplyFilters: mockOnApplyFilters,
    onClearFilters: mockOnClearFilters,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectApi.getAll.mockResolvedValue({
      projects: [
        {
          id: '1',
          name: 'Project 1',
          color: '#3B82F6',
          userId: 'user1',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Project 2',
          color: '#EF4444',
          userId: 'user1',
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
      count: 2,
    });
  });

  it('renders filter components', async () => {
    render(<ReportFilters {...defaultProps} />, { wrapper: createWrapper() });

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('Date Range')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Group By')).toBeInTheDocument();
    expect(screen.getByText('Apply Filters')).toBeInTheDocument();
  });

  it('calls onApplyFilters when apply button is clicked', () => {
    render(<ReportFilters {...defaultProps} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Apply Filters'));
    expect(mockOnApplyFilters).toHaveBeenCalledTimes(1);
  });

  it('calls onClearFilters when clear button is clicked', () => {
    const filtersWithData: ReportFiltersType = {
      dateRange: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      },
    };

    render(
      <ReportFilters {...defaultProps} filters={filtersWithData} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText('Clear'));
    expect(mockOnClearFilters).toHaveBeenCalledTimes(1);
  });

  it('shows clear all button when filters are active', () => {
    const filtersWithData: ReportFiltersType = {
      dateRange: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      },
    };

    render(
      <ReportFilters {...defaultProps} filters={filtersWithData} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('disables clear button when no filters are active', () => {
    render(<ReportFilters {...defaultProps} />, { wrapper: createWrapper() });

    const clearButton = screen.getByText('Clear');
    expect(clearButton).toBeDisabled();
  });

  it('loads projects for project filter', async () => {
    render(<ReportFilters {...defaultProps} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockProjectApi.getAll).toHaveBeenCalledWith({ includeInactive: true });
    });
  });
});