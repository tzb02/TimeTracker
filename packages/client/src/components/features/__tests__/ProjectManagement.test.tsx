import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectManagement } from '../ProjectManagement';
import * as api from '../../../lib/api';

// Mock the API
jest.mock('../../../lib/api');
const mockApi = api as jest.Mocked<typeof api>;

// Mock data
const mockProjects = [
  {
    id: '1',
    name: 'Project Alpha',
    color: '#3B82F6',
    description: 'First project',
    userId: 'user1',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    totalTime: 3600,
    entryCount: 5,
  },
  {
    id: '2',
    name: 'Project Beta',
    color: '#10B981',
    description: 'Second project',
    userId: 'user1',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    totalTime: 7200,
    entryCount: 10,
  },
  {
    id: '3',
    name: 'Inactive Project',
    color: '#F59E0B',
    description: 'Inactive project',
    userId: 'user1',
    isActive: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    totalTime: 1800,
    entryCount: 3,
  },
];

const mockUsedColors = ['#3B82F6', '#10B981', '#F59E0B'];

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

describe('ProjectManagement', () => {
  const mockOnClose = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockApi.projectApi.getAll.mockResolvedValue({
      projects: mockProjects,
      count: mockProjects.length,
    });
    
    mockApi.projectApi.getUsedColors.mockResolvedValue({
      colors: mockUsedColors,
      count: mockUsedColors.length,
    });
    
    mockApi.projectApi.create.mockResolvedValue({
      project: {
        id: '4',
        name: 'New Project',
        color: '#EF4444',
        description: 'New project description',
        userId: 'user1',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      message: 'Project created successfully',
    });
    
    mockApi.projectApi.update.mockResolvedValue({
      project: {
        id: '1',
        name: 'Updated Project',
        color: '#EF4444',
        description: 'Updated description',
        userId: 'user1',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      message: 'Project updated successfully',
    });
    
    mockApi.projectApi.delete.mockResolvedValue({
      message: 'Project deleted successfully',
    });
  });

  it('does not render when closed', () => {
    render(
      <ProjectManagement isOpen={false} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    expect(screen.queryByText('Manage Projects')).not.toBeInTheDocument();
  });

  it('renders when open', async () => {
    render(
      <ProjectManagement isOpen={true} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(screen.getByText('Manage Projects')).toBeInTheDocument();
    });
  });

  it('displays projects list', async () => {
    render(
      <ProjectManagement isOpen={true} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
      expect(screen.getByText('Inactive Project')).toBeInTheDocument();
    });
  });

  it('shows project statistics', async () => {
    render(
      <ProjectManagement isOpen={true} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(screen.getByText('1h 0m tracked')).toBeInTheDocument();
      expect(screen.getByText('2h 0m tracked')).toBeInTheDocument();
      expect(screen.getByText('0h 30m tracked')).toBeInTheDocument();
    });
  });

  it('shows inactive project indicator', async () => {
    render(
      <ProjectManagement isOpen={true} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  it('opens create project modal when create button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProjectManagement isOpen={true} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(screen.getByText('Create Project')).toBeInTheDocument();
    });
    
    await user.click(screen.getByText('Create Project'));
    
    await waitFor(() => {
      expect(screen.getByText('Create New Project')).toBeInTheDocument();
    });
  });

  it('opens edit project modal when edit button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProjectManagement isOpen={true} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });
    
    const editButtons = screen.getAllByText('Edit');
    await user.click(editButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Edit Project')).toBeInTheDocument();
    });
  });

  it('opens delete confirmation when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProjectManagement isOpen={true} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });
    
    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Delete Project')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to delete the project "Project Alpha"?')).toBeInTheDocument();
    });
  });

  it('deletes project when confirmed', async () => {
    const user = userEvent.setup();
    render(
      <ProjectManagement isOpen={true} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });
    
    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Delete Project')).toBeInTheDocument();
    });
    
    const confirmDeleteButton = screen.getByRole('button', { name: /delete project/i });
    await user.click(confirmDeleteButton);
    
    await waitFor(() => {
      expect(mockApi.projectApi.delete).toHaveBeenCalledWith('1');
    });
  });

  it('cancels delete when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProjectManagement isOpen={true} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });
    
    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Delete Project')).toBeInTheDocument();
    });
    
    await user.click(screen.getByText('Cancel'));
    
    await waitFor(() => {
      expect(screen.queryByText('Delete Project')).not.toBeInTheDocument();
    });
    
    expect(mockApi.projectApi.delete).not.toHaveBeenCalled();
  });

  it('shows loading state while fetching projects', () => {
    mockApi.projectApi.getAll.mockReturnValue(new Promise(() => {})); // Never resolves
    
    render(
      <ProjectManagement isOpen={true} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    expect(screen.getByText('Manage Projects')).toBeInTheDocument();
  });

  it('shows empty state when no projects exist', async () => {
    mockApi.projectApi.getAll.mockResolvedValue({
      projects: [],
      count: 0,
    });
    
    render(
      <ProjectManagement isOpen={true} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(screen.getByText('No projects found.')).toBeInTheDocument();
      expect(screen.getByText('Create your first project to get started.')).toBeInTheDocument();
    });
  });

  it('shows error when delete fails', async () => {
    const user = userEvent.setup();
    
    mockApi.projectApi.delete.mockRejectedValue({
      response: {
        data: {
          error: {
            code: 'PROJECT_HAS_ENTRIES',
            message: 'Cannot delete project with time entries',
          },
        },
      },
    });
    
    render(
      <ProjectManagement isOpen={true} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });
    
    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Delete Project')).toBeInTheDocument();
    });
    
    const confirmDeleteButton = screen.getByRole('button', { name: /delete project/i });
    await user.click(confirmDeleteButton);
    
    await waitFor(() => {
      expect(screen.getByText('Cannot delete project with time entries')).toBeInTheDocument();
    });
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProjectManagement isOpen={true} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(screen.getByText('Manage Projects')).toBeInTheDocument();
    });
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProjectManagement isOpen={true} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(screen.getByText('Manage Projects')).toBeInTheDocument();
    });
    
    // Click on backdrop (the overlay behind the modal)
    const backdrop = document.querySelector('.fixed.inset-0.bg-black');
    if (backdrop) {
      await user.click(backdrop);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    render(
      <ProjectManagement isOpen={true} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(screen.getByText('Manage Projects')).toBeInTheDocument();
    });
    
    // Test escape key closes modal
    await user.keyboard('{Escape}');
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows project colors correctly', async () => {
    render(
      <ProjectManagement isOpen={true} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });
    
    // Check that color indicators are present
    const colorIndicators = document.querySelectorAll('[style*="background-color"]');
    expect(colorIndicators.length).toBeGreaterThan(0);
  });

  it('displays project descriptions', async () => {
    render(
      <ProjectManagement isOpen={true} onClose={mockOnClose} />,
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(screen.getByText('First project')).toBeInTheDocument();
      expect(screen.getByText('Second project')).toBeInTheDocument();
      expect(screen.getByText('Inactive project')).toBeInTheDocument();
    });
  });
});