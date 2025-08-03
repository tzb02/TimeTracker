import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectSelector } from '../ProjectSelector';
import { useAppStore } from '../../../store/useAppStore';
import * as api from '../../../lib/api';

// Mock the API
jest.mock('../../../lib/api');
const mockApi = api as jest.Mocked<typeof api>;

// Mock the store
jest.mock('../../../store/useAppStore');
const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>;

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
  },
];

const mockUsedColors = ['#3B82F6', '#10B981'];

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

describe('ProjectSelector', () => {
  const mockSetState = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseAppStore.mockReturnValue({
      timer: {
        isRunning: false,
        projectId: '1',
        description: '',
        startTime: null,
        elapsedTime: 0,
      },
    });
    
    mockUseAppStore.setState = mockSetState;
    
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
  });

  it('renders with selected project', async () => {
    render(<ProjectSelector />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });
    
    expect(screen.getByRole('button')).toHaveTextContent('Project Alpha');
  });

  it('shows placeholder when no project selected', async () => {
    mockUseAppStore.mockReturnValue({
      timer: {
        isRunning: false,
        projectId: null,
        description: '',
        startTime: null,
        elapsedTime: 0,
      },
    });
    
    render(<ProjectSelector />, { wrapper: createWrapper() });
    
    expect(screen.getByText('Select a project...')).toBeInTheDocument();
  });

  it('opens dropdown when clicked', async () => {
    const user = userEvent.setup();
    render(<ProjectSelector />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });
    
    await user.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
    });
  });

  it('displays projects in dropdown', async () => {
    const user = userEvent.setup();
    render(<ProjectSelector />, { wrapper: createWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });
    
    await user.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
      expect(screen.getByText('Inactive Project')).toBeInTheDocument();
    });
  });

  it('filters projects based on search term', async () => {
    const user = userEvent.setup();
    render(<ProjectSelector />, { wrapper: createWrapper() });
    
    await user.click(screen.getByRole('button'));
    
    const searchInput = await screen.findByPlaceholderText('Search projects...');
    await user.type(searchInput, 'Alpha');
    
    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.queryByText('Project Beta')).not.toBeInTheDocument();
    });
  });

  it('shows create option when search term does not match existing projects', async () => {
    const user = userEvent.setup();
    render(<ProjectSelector />, { wrapper: createWrapper() });
    
    await user.click(screen.getByRole('button'));
    
    const searchInput = await screen.findByPlaceholderText('Search projects...');
    await user.type(searchInput, 'New Project Name');
    
    await waitFor(() => {
      expect(screen.getByText('Create "New Project Name"')).toBeInTheDocument();
    });
  });

  it('selects project when clicked', async () => {
    const user = userEvent.setup();
    render(<ProjectSelector />, { wrapper: createWrapper() });
    
    await user.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
    });
    
    await user.click(screen.getByText('Project Beta'));
    
    expect(mockSetState).toHaveBeenCalledWith(expect.any(Function));
  });

  it('disables selection when timer is running', async () => {
    mockUseAppStore.mockReturnValue({
      timer: {
        isRunning: true,
        projectId: '1',
        description: '',
        startTime: new Date().toISOString(),
        elapsedTime: 0,
      },
    });
    
    render(<ProjectSelector />, { wrapper: createWrapper() });
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('opens create form when "New Project" button is clicked', async () => {
    const user = userEvent.setup();
    render(<ProjectSelector />, { wrapper: createWrapper() });
    
    await user.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(screen.getByText('New Project')).toBeInTheDocument();
    });
    
    await user.click(screen.getByText('New Project'));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Project name')).toBeInTheDocument();
    });
  });

  it('creates new project from inline form', async () => {
    const user = userEvent.setup();
    render(<ProjectSelector />, { wrapper: createWrapper() });
    
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('New Project'));
    
    const nameInput = await screen.findByPlaceholderText('Project name');
    await user.type(nameInput, 'Test Project');
    
    const descriptionInput = screen.getByPlaceholderText('Description (optional)');
    await user.type(descriptionInput, 'Test description');
    
    await user.click(screen.getByText('Create'));
    
    await waitFor(() => {
      expect(mockApi.projectApi.create).toHaveBeenCalledWith({
        name: 'Test Project',
        color: '#3B82F6',
        description: 'Test description',
      });
    });
  });

  it('shows error when project creation fails', async () => {
    const user = userEvent.setup();
    
    mockApi.projectApi.create.mockRejectedValue({
      response: {
        data: {
          error: {
            code: 'PROJECT_NAME_EXISTS',
            message: 'A project with this name already exists',
          },
        },
      },
    });
    
    render(<ProjectSelector />, { wrapper: createWrapper() });
    
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('New Project'));
    
    const nameInput = await screen.findByPlaceholderText('Project name');
    await user.type(nameInput, 'Existing Project');
    
    await user.click(screen.getByText('Create'));
    
    await waitFor(() => {
      expect(screen.getByText('A project with this name already exists')).toBeInTheDocument();
    });
  });

  it('calls onManageProjects when manage button is clicked', async () => {
    const mockOnManageProjects = jest.fn();
    const user = userEvent.setup();
    
    render(<ProjectSelector onManageProjects={mockOnManageProjects} />, { 
      wrapper: createWrapper() 
    });
    
    await user.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(screen.getByText('Manage')).toBeInTheDocument();
    });
    
    await user.click(screen.getByText('Manage'));
    
    expect(mockOnManageProjects).toHaveBeenCalled();
  });

  it('closes dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ProjectSelector />
        <div data-testid="outside">Outside element</div>
      </div>,
      { wrapper: createWrapper() }
    );
    
    await user.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
    });
    
    await user.click(screen.getByTestId('outside'));
    
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search projects...')).not.toBeInTheDocument();
    });
  });

  it('shows loading state while fetching projects', () => {
    mockApi.projectApi.getAll.mockReturnValue(new Promise(() => {})); // Never resolves
    
    render(<ProjectSelector />, { wrapper: createWrapper() });
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<ProjectSelector />, { wrapper: createWrapper() });
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    const searchInput = await screen.findByPlaceholderText('Search projects...');
    
    // Test escape key closes dropdown
    await user.keyboard('{Escape}');
    
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search projects...')).not.toBeInTheDocument();
    });
  });

  it('prefills create form with search term when create option is clicked', async () => {
    const user = userEvent.setup();
    render(<ProjectSelector />, { wrapper: createWrapper() });
    
    await user.click(screen.getByRole('button'));
    
    const searchInput = await screen.findByPlaceholderText('Search projects...');
    await user.type(searchInput, 'My New Project');
    
    await waitFor(() => {
      expect(screen.getByText('Create "My New Project"')).toBeInTheDocument();
    });
    
    await user.click(screen.getByText('Create "My New Project"'));
    
    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText('Project name');
      expect(nameInput).toHaveValue('My New Project');
    });
  });
});