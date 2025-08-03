import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';
import { server } from '../test/mocks/server';
import { rest } from 'msw';

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1,
}));

// Mock IndexedDB
Object.defineProperty(window, 'indexedDB', {
  value: {
    open: jest.fn().mockResolvedValue({
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          add: jest.fn(),
          get: jest.fn(),
          put: jest.fn(),
          delete: jest.fn(),
        }),
      }),
    }),
  },
});

describe('Integration Tests', () => {
  let queryClient: QueryClient;

  beforeAll(() => {
    server.listen();
  });

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
  });

  afterAll(() => {
    server.close();
  });

  const renderApp = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('completes full user workflow', async () => {
    renderApp();

    // Should show login form initially
    expect(screen.getByText(/login/i)).toBeInTheDocument();

    // Login
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    // Should show main app after login
    await waitFor(() => {
      expect(screen.getByText('Time Tracker')).toBeInTheDocument();
    });

    // Should show timer controls
    expect(screen.getByText('00:00:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();

    // Create a project
    fireEvent.click(screen.getByText(/add project/i));
    fireEvent.change(screen.getByLabelText(/project name/i), {
      target: { value: 'Test Project' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Select project and start timer
    fireEvent.click(screen.getByText('Test Project'));
    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    });

    // Stop timer
    fireEvent.click(screen.getByRole('button', { name: /stop/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
    });

    // Navigate to time entries
    fireEvent.click(screen.getByText(/entries/i));

    await waitFor(() => {
      expect(screen.getByText(/time entries/i)).toBeInTheDocument();
    });

    // Navigate to reports
    fireEvent.click(screen.getByText(/reports/i));

    await waitFor(() => {
      expect(screen.getByText(/reports/i)).toBeInTheDocument();
    });
  });

  it('handles offline functionality', async () => {
    // Mock offline state
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    renderApp();

    // Should show offline indicator
    await waitFor(() => {
      expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });

    // Actions should still work (queued for sync)
    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    // Should show that action was queued
    await waitFor(() => {
      expect(screen.getByText(/queued/i)).toBeInTheDocument();
    });

    // Go back online
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    window.dispatchEvent(new Event('online'));

    // Should sync queued actions
    await waitFor(() => {
      expect(screen.queryByText(/queued/i)).not.toBeInTheDocument();
    });
  });

  it('handles iframe embedding', async () => {
    // Mock iframe environment
    Object.defineProperty(window, 'parent', {
      value: {
        postMessage: jest.fn(),
      },
    });

    Object.defineProperty(window, 'top', {
      value: {},
    });

    renderApp();

    // Should detect iframe environment
    await waitFor(() => {
      expect(screen.getByTestId('iframe-layout')).toBeInTheDocument();
    });

    // Should have compact layout
    expect(screen.getByTestId('iframe-layout')).toHaveClass('iframe-mode');
  });

  it('handles real-time updates', async () => {
    renderApp();

    // Mock WebSocket connection
    const mockWebSocket = new WebSocket('ws://localhost:3001');
    
    // Simulate receiving a timer update
    const timerUpdateEvent = new MessageEvent('message', {
      data: JSON.stringify({
        type: 'timer_update',
        data: {
          id: 'timer1',
          isRunning: true,
          elapsedTime: 60,
        },
      }),
    });

    mockWebSocket.dispatchEvent(timerUpdateEvent);

    // Should update timer display
    await waitFor(() => {
      expect(screen.getByText('00:01:00')).toBeInTheDocument();
    });
  });

  it('handles error scenarios gracefully', async () => {
    // Mock network error
    server.use(
      rest.post('/api/auth/login', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ error: 'Server error' }));
      })
    );

    renderApp();

    // Try to login
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });

    // Should allow retry
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('validates all requirements', async () => {
    renderApp();

    // Requirement 1.1: Iframe embedding support
    expect(window.parent.postMessage).toBeDefined();

    // Requirement 2.1: Timer functionality
    expect(screen.getByText('00:00:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();

    // Requirement 3.1: User authentication
    expect(screen.getByText(/login/i)).toBeInTheDocument();

    // Requirement 7.1: Offline functionality
    expect(navigator.serviceWorker).toBeDefined();

    // Requirement 9.1: Responsive design
    expect(document.querySelector('meta[name="viewport"]')).toBeTruthy();

    // Requirement 10.1: Security
    expect(document.querySelector('meta[http-equiv="Content-Security-Policy"]')).toBeTruthy();
  });
});