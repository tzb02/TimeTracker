import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { TimeEntryItem } from '../TimeEntryItem';
import { TimeEntryWithProject } from '../../../lib/api';

// Mock the API
vi.mock('../../../lib/api');

// Mock the time utilities
vi.mock('../../../utils/time', () => ({
  formatDuration: (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`,
  formatTime: (date: string) => new Date(date).toLocaleTimeString(),
  parseDuration: (duration: string) => {
    const parts = duration.split(':').map(Number);
    return parts[0] * 60 + parts[1];
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

const mockEntry: TimeEntryWithProject = {
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
};

describe('TimeEntryItem', () => {
  const defaultProps = {
    entry: mockEntry,
    isSelected: false,
    onSelect: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    isEditing: false,
    onEditComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders time entry information', () => {
    renderWithQueryClient(<TimeEntryItem {...defaultProps} />);
    
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('Test task')).toBeInTheDocument();
    expect(screen.getByText('60:00')).toBeInTheDocument(); // Duration
  });

  it('shows running indicator for active entries', () => {
    const runningEntry = { ...mockEntry, isRunning: true };
    renderWithQueryClient(
      <TimeEntryItem {...defaultProps} entry={runningEntry} />
    );
    
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('calls onSelect when checkbox is clicked', () => {
    const onSelect = vi.fn();
    renderWithQueryClient(
      <TimeEntryItem {...defaultProps} onSelect={onSelect} />
    );
    
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    
    expect(onSelect).toHaveBeenCalledWith(true);
  });

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();
    renderWithQueryClient(
      <TimeEntryItem {...defaultProps} onEdit={onEdit} />
    );
    
    const editButton = screen.getByTitle('Edit entry');
    fireEvent.click(editButton);
    
    expect(onEdit).toHaveBeenCalled();
  });

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    renderWithQueryClient(
      <TimeEntryItem {...defaultProps} onDelete={onDelete} />
    );
    
    const deleteButton = screen.getByTitle('Delete entry');
    fireEvent.click(deleteButton);
    
    expect(onDelete).toHaveBeenCalled();
  });

  it('shows edit form when isEditing is true', () => {
    renderWithQueryClient(
      <TimeEntryItem {...defaultProps} isEditing={true} />
    );
    
    expect(screen.getByDisplayValue('Test task')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });
});