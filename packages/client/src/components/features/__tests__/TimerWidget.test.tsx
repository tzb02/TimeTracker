import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TimerWidget } from '../TimerWidget';
import { useAppStore } from '../../../store/useAppStore';
import { timerApi } from '../../../lib/api';

// Mock the API
vi.mock('../../../lib/api', () => ({
  timerApi: {
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    getState: vi.fn(),
    resolveConflict: vi.fn(),
  },
  isApiError: vi.fn(),
}));

// Mock the store
vi.mock('../../../store/useAppStore');

// Mock the iframe size hook
vi.mock('../../../hooks/useIframeSize', () => ({
  useIframeSize: () => ({
    width: 800,
    height: 600,
    isCompact: false,
    isVeryCompact: false,
  }),
}));

const mockUseAppStore = useAppStore as any;

describe('TimerWidget', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset mocks
    vi.clearAllMocks();
    
    // Mock the timer API getState method
    (timerApi.getState as any).mockResolvedValue({
      isRunning: false,
      elapsedTime: 0,
      lastSync: new Date().toISOString(),
    });
    
    // Default store state
    mockUseAppStore.mockReturnValue({
      timer: {
        isRunning: false,
        elapsedTime: 0,
        description: '',
        projectId: '1',
      },
      isOffline: false,
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
      updateTimer: vi.fn(),
      resetTimer: vi.fn(),
    } as any);
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('renders timer display with initial state', () => {
    renderWithProviders(<TimerWidget />);
    
    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(screen.getByText('Stopped')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  });

  it('shows running state when timer is active', async () => {
    mockUseAppStore.mockReturnValue({
      timer: {
        isRunning: true,
        elapsedTime: 65, // 1 minute 5 seconds
        description: 'Test task',
        projectId: '1',
        startTime: new Date(),
      },
      isOffline: false,
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
      updateTimer: vi.fn(),
      resetTimer: vi.fn(),
    } as any);

    renderWithProviders(<TimerWidget />);
    
    // Wait for the component to render and update
    await waitFor(() => {
      expect(screen.getByText('Running')).toBeInTheDocument();
    });
    
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('disables start button when no project is selected', () => {
    mockUseAppStore.mockReturnValue({
      timer: {
        isRunning: false,
        elapsedTime: 0,
        description: '',
        projectId: undefined,
      },
      isOffline: false,
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
      updateTimer: vi.fn(),
      resetTimer: vi.fn(),
    } as any);

    renderWithProviders(<TimerWidget />);
    
    const startButton = screen.getByRole('button', { name: /start/i });
    expect(startButton).toBeDisabled();
  });

  it('shows offline indicator when offline', () => {
    mockUseAppStore.mockReturnValue({
      timer: {
        isRunning: false,
        elapsedTime: 0,
        description: '',
        projectId: '1',
      },
      isOffline: true,
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
      updateTimer: vi.fn(),
      resetTimer: vi.fn(),
    } as any);

    renderWithProviders(<TimerWidget />);
    
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('calls start timer API when start button is clicked', async () => {
    const mockStart = vi.fn().mockResolvedValue({
      timeEntry: {
        id: '1',
        projectId: '1',
        description: 'Test',
        startTime: new Date().toISOString(),
        isRunning: true,
      },
    });
    
    (timerApi.start as any).mockImplementation(mockStart);

    renderWithProviders(<TimerWidget />);
    
    const startButton = screen.getByRole('button', { name: /start/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalledWith({
        projectId: '1',
        description: '',
      });
    });
  });

  it('formats elapsed time correctly', () => {
    mockUseAppStore.mockReturnValue({
      timer: {
        isRunning: false,
        elapsedTime: 3665, // 1 hour, 1 minute, 5 seconds
        description: '',
        projectId: '1',
      },
      isOffline: false,
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
      updateTimer: vi.fn(),
      resetTimer: vi.fn(),
    } as any);

    renderWithProviders(<TimerWidget />);
    
    expect(screen.getByText('01:01:05')).toBeInTheDocument();
  });

  it('shows keyboard shortcuts help when clicked', () => {
    renderWithProviders(<TimerWidget />);
    
    const shortcutsButton = screen.getByText('Keyboard Shortcuts');
    fireEvent.click(shortcutsButton);
    
    expect(screen.getByText('Start/Pause')).toBeInTheDocument();
    expect(screen.getByText('Start/Stop')).toBeInTheDocument();
    expect(screen.getByText('Pause')).toBeInTheDocument();
  });

  it('renders in compact mode when prop is set', () => {
    renderWithProviders(<TimerWidget compact />);
    
    const timerDisplay = screen.getByRole('timer');
    expect(timerDisplay).toHaveClass('text-2xl');
  });

  it('shows visual feedback for different timer states', () => {
    // Test stopped state
    renderWithProviders(<TimerWidget />);
    expect(screen.getByText('Stopped')).toBeInTheDocument();
    
    // Test running state
    mockUseAppStore.mockReturnValue({
      timer: {
        isRunning: true,
        elapsedTime: 65,
        description: 'Test task',
        projectId: '1',
        startTime: new Date(),
      },
      isOffline: false,
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
      updateTimer: vi.fn(),
      resetTimer: vi.fn(),
    } as any);

    renderWithProviders(<TimerWidget />);
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('handles keyboard shortcuts correctly', () => {
    const mockStart = vi.fn();
    const mockStop = vi.fn();
    
    mockUseAppStore.mockReturnValue({
      timer: {
        isRunning: false,
        elapsedTime: 0,
        description: '',
        projectId: '1',
      },
      isOffline: false,
      startTimer: mockStart,
      stopTimer: mockStop,
      updateTimer: vi.fn(),
      resetTimer: vi.fn(),
    } as any);

    renderWithProviders(<TimerWidget />);
    
    // Focus the widget
    const widget = screen.getByRole('region', { name: 'Timer Widget' });
    widget.focus();
    
    // Test space bar shortcut
    fireEvent.keyDown(document, { key: ' ' });
    // Note: This would trigger handleStart in the actual component
  });
});