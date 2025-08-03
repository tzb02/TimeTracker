import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TimeEntryPage } from '../TimeEntryPage';
import { useTimeEntryStore } from '../../../store/useTimeEntryStore';

// Mock stores
jest.mock('../../../store/useTimeEntryStore');

const mockUseTimeEntryStore = useTimeEntryStore as jest.MockedFunction<typeof useTimeEntryStore>;

describe('TimeEntryPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockUseTimeEntryStore.mockReturnValue({
      timeEntries: [
        {
          id: '1',
          projectId: '1',
          description: 'Test task 1',
          startTime: new Date('2024-01-01T09:00:00Z'),
          endTime: new Date('2024-01-01T10:00:00Z'),
          duration: 3600,
          userId: 'user1',
        },
        {
          id: '2',
          projectId: '2',
          description: 'Test task 2',
          startTime: new Date('2024-01-01T11:00:00Z'),
          endTime: new Date('2024-01-01T12:30:00Z'),
          duration: 5400,
          userId: 'user1',
        },
      ],
      isLoading: false,
      error: null,
      fetchTimeEntries: jest.fn(),
      createTimeEntry: jest.fn(),
      updateTimeEntry: jest.fn(),
      deleteTimeEntry: jest.fn(),
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('renders time entries list', () => {
    renderWithProviders(<TimeEntryPage />);

    expect(screen.getByText('Time Entries')).toBeInTheDocument();
    expect(screen.getByText('Test task 1')).toBeInTheDocument();
    expect(screen.getByText('Test task 2')).toBeInTheDocument();
    expect(screen.getByText('1h 0m')).toBeInTheDocument();
    expect(screen.getByText('1h 30m')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUseTimeEntryStore.mockReturnValue({
      timeEntries: [],
      isLoading: true,
      error: null,
      fetchTimeEntries: jest.fn(),
      createTimeEntry: jest.fn(),
      updateTimeEntry: jest.fn(),
      deleteTimeEntry: jest.fn(),
    });

    renderWithProviders(<TimeEntryPage />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUseTimeEntryStore.mockReturnValue({
      timeEntries: [],
      isLoading: false,
      error: 'Failed to load time entries',
      fetchTimeEntries: jest.fn(),
      createTimeEntry: jest.fn(),
      updateTimeEntry: jest.fn(),
      deleteTimeEntry: jest.fn(),
    });

    renderWithProviders(<TimeEntryPage />);

    expect(screen.getByText('Failed to load time entries')).toBeInTheDocument();
  });

  it('allows editing time entry', async () => {
    const mockUpdateTimeEntry = jest.fn();
    mockUseTimeEntryStore.mockReturnValue({
      timeEntries: [
        {
          id: '1',
          projectId: '1',
          description: 'Test task 1',
          startTime: new Date('2024-01-01T09:00:00Z'),
          endTime: new Date('2024-01-01T10:00:00Z'),
          duration: 3600,
          userId: 'user1',
        },
      ],
      isLoading: false,
      error: null,
      fetchTimeEntries: jest.fn(),
      createTimeEntry: jest.fn(),
      updateTimeEntry: mockUpdateTimeEntry,
      deleteTimeEntry: jest.fn(),
    });

    renderWithProviders(<TimeEntryPage />);

    // Click edit button
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    // Update description
    const descriptionInput = screen.getByDisplayValue('Test task 1');
    fireEvent.change(descriptionInput, { target: { value: 'Updated task' } });

    // Save changes
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdateTimeEntry).toHaveBeenCalledWith('1', {
        description: 'Updated task',
      });
    });
  });

  it('allows deleting time entry', async () => {
    const mockDeleteTimeEntry = jest.fn();
    mockUseTimeEntryStore.mockReturnValue({
      timeEntries: [
        {
          id: '1',
          projectId: '1',
          description: 'Test task 1',
          startTime: new Date('2024-01-01T09:00:00Z'),
          endTime: new Date('2024-01-01T10:00:00Z'),
          duration: 3600,
          userId: 'user1',
        },
      ],
      isLoading: false,
      error: null,
      fetchTimeEntries: jest.fn(),
      createTimeEntry: jest.fn(),
      updateTimeEntry: jest.fn(),
      deleteTimeEntry: mockDeleteTimeEntry,
    });

    renderWithProviders(<TimeEntryPage />);

    // Click delete button
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    // Confirm deletion
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(mockDeleteTimeEntry).toHaveBeenCalledWith('1');
    });
  });
});