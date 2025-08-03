import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TimerPage } from '../TimerPage';
import { useTimerStore } from '../../../store/useTimerStore';
import { useProjectStore } from '../../../store/useProjectStore';

// Mock stores
jest.mock('../../../store/useTimerStore');
jest.mock('../../../store/useProjectStore');
jest.mock('../../../hooks/useSocket');

const mockUseTimerStore = useTimerStore as jest.MockedFunction<typeof useTimerStore>;
const mockUseProjectStore = useProjectStore as jest.MockedFunction<typeof useProjectStore>;

describe('TimerPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockUseTimerStore.mockReturnValue({
      currentTimer: null,
      isRunning: false,
      elapsedTime: 0,
      startTimer: jest.fn(),
      stopTimer: jest.fn(),
      pauseTimer: jest.fn(),
      resumeTimer: jest.fn(),
    });

    mockUseProjectStore.mockReturnValue({
      projects: [
        { id: '1', name: 'Project 1', color: '#3B82F6', userId: 'user1' },
        { id: '2', name: 'Project 2', color: '#EF4444', userId: 'user1' },
      ],
      selectedProject: null,
      setSelectedProject: jest.fn(),
      createProject: jest.fn(),
      updateProject: jest.fn(),
      deleteProject: jest.fn(),
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('renders timer controls', () => {
    renderWithProviders(<TimerPage />);

    expect(screen.getByText('00:00:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  });

  it('displays running timer', () => {
    mockUseTimerStore.mockReturnValue({
      currentTimer: {
        id: 'timer1',
        projectId: '1',
        startTime: new Date(),
        userId: 'user1',
      },
      isRunning: true,
      elapsedTime: 3661, // 1 hour, 1 minute, 1 second
      startTimer: jest.fn(),
      stopTimer: jest.fn(),
      pauseTimer: jest.fn(),
      resumeTimer: jest.fn(),
    });

    renderWithProviders(<TimerPage />);

    expect(screen.getByText('01:01:01')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('starts timer when start button is clicked', async () => {
    const mockStartTimer = jest.fn();
    mockUseTimerStore.mockReturnValue({
      currentTimer: null,
      isRunning: false,
      elapsedTime: 0,
      startTimer: mockStartTimer,
      stopTimer: jest.fn(),
      pauseTimer: jest.fn(),
      resumeTimer: jest.fn(),
    });

    mockUseProjectStore.mockReturnValue({
      projects: [{ id: '1', name: 'Project 1', color: '#3B82F6', userId: 'user1' }],
      selectedProject: { id: '1', name: 'Project 1', color: '#3B82F6', userId: 'user1' },
      setSelectedProject: jest.fn(),
      createProject: jest.fn(),
      updateProject: jest.fn(),
      deleteProject: jest.fn(),
    });

    renderWithProviders(<TimerPage />);

    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    await waitFor(() => {
      expect(mockStartTimer).toHaveBeenCalledWith('1');
    });
  });

  it('shows project selection', () => {
    renderWithProviders(<TimerPage />);

    expect(screen.getByText('Select Project')).toBeInTheDocument();
    expect(screen.getByText('Project 1')).toBeInTheDocument();
    expect(screen.getByText('Project 2')).toBeInTheDocument();
  });
});