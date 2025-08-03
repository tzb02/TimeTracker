import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionIndicator, ConnectionStatus } from '../ConnectionIndicator';
import { useSocketStatus } from '../../../hooks/useSocket';

// Mock the useSocketStatus hook
vi.mock('../../../hooks/useSocket', () => ({
  useSocketStatus: vi.fn()
}));

describe('ConnectionIndicator', () => {
  const mockUseSocketStatus = useSocketStatus as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Visual Indicators', () => {
    it('should show green indicator for websocket connection', () => {
      mockUseSocketStatus.mockReturnValue({
        isConnected: true,
        isPolling: false,
        connectionType: 'websocket'
      });

      const { container } = render(<ConnectionIndicator />);
      const indicator = container.querySelector('div > div');
      
      expect(indicator).toHaveClass('bg-green-500');
    });

    it('should show yellow indicator for polling connection', () => {
      mockUseSocketStatus.mockReturnValue({
        isConnected: true,
        isPolling: false,
        connectionType: 'polling'
      });

      const { container } = render(<ConnectionIndicator />);
      const indicator = container.querySelector('div > div');
      
      expect(indicator).toHaveClass('bg-yellow-500');
    });

    it('should show orange indicator for polling fallback', () => {
      mockUseSocketStatus.mockReturnValue({
        isConnected: false,
        isPolling: true,
        connectionType: 'disconnected'
      });

      const { container } = render(<ConnectionIndicator />);
      const indicator = container.querySelector('div > div');
      
      expect(indicator).toHaveClass('bg-orange-500');
    });

    it('should show red indicator for disconnected state', () => {
      mockUseSocketStatus.mockReturnValue({
        isConnected: false,
        isPolling: false,
        connectionType: 'disconnected'
      });

      const { container } = render(<ConnectionIndicator />);
      const indicator = container.querySelector('div > div');
      
      expect(indicator).toHaveClass('bg-red-500');
    });
  });

  describe('Size Variants', () => {
    it('should apply small size classes', () => {
      mockUseSocketStatus.mockReturnValue({
        isConnected: true,
        isPolling: false,
        connectionType: 'websocket'
      });

      const { container } = render(<ConnectionIndicator size="sm" />);
      const indicator = container.querySelector('div > div');
      
      expect(indicator).toHaveClass('w-2', 'h-2');
    });

    it('should apply medium size classes', () => {
      mockUseSocketStatus.mockReturnValue({
        isConnected: true,
        isPolling: false,
        connectionType: 'websocket'
      });

      const { container } = render(<ConnectionIndicator size="md" />);
      const indicator = container.querySelector('div > div');
      
      expect(indicator).toHaveClass('w-3', 'h-3');
    });

    it('should apply large size classes', () => {
      mockUseSocketStatus.mockReturnValue({
        isConnected: true,
        isPolling: false,
        connectionType: 'websocket'
      });

      const { container } = render(<ConnectionIndicator size="lg" />);
      const indicator = container.querySelector('div > div');
      
      expect(indicator).toHaveClass('w-4', 'h-4');
    });
  });

  describe('Text Display', () => {
    it('should show text when showText is true', () => {
      mockUseSocketStatus.mockReturnValue({
        isConnected: true,
        isPolling: false,
        connectionType: 'websocket'
      });

      render(<ConnectionIndicator showText={true} />);
      
      expect(screen.getByText('Real-time')).toBeInTheDocument();
    });

    it('should not show text when showText is false', () => {
      mockUseSocketStatus.mockReturnValue({
        isConnected: true,
        isPolling: false,
        connectionType: 'websocket'
      });

      render(<ConnectionIndicator showText={false} />);
      
      expect(screen.queryByText('Real-time')).not.toBeInTheDocument();
    });

    it('should show correct text for different connection states', () => {
      // Websocket connection
      mockUseSocketStatus.mockReturnValue({
        isConnected: true,
        isPolling: false,
        connectionType: 'websocket'
      });

      const { rerender } = render(<ConnectionIndicator showText={true} />);
      expect(screen.getByText('Real-time')).toBeInTheDocument();

      // Polling connection
      mockUseSocketStatus.mockReturnValue({
        isConnected: true,
        isPolling: false,
        connectionType: 'polling'
      });

      rerender(<ConnectionIndicator showText={true} />);
      expect(screen.getByText('Connected')).toBeInTheDocument();

      // Polling fallback
      mockUseSocketStatus.mockReturnValue({
        isConnected: false,
        isPolling: true,
        connectionType: 'disconnected'
      });

      rerender(<ConnectionIndicator showText={true} />);
      expect(screen.getByText('Polling')).toBeInTheDocument();

      // Disconnected
      mockUseSocketStatus.mockReturnValue({
        isConnected: false,
        isPolling: false,
        connectionType: 'disconnected'
      });

      rerender(<ConnectionIndicator showText={true} />);
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  describe('Tooltips', () => {
    it('should show tooltip with connection description', () => {
      mockUseSocketStatus.mockReturnValue({
        isConnected: true,
        isPolling: false,
        connectionType: 'websocket'
      });

      const { container } = render(<ConnectionIndicator />);
      const indicator = container.firstChild as HTMLElement;
      
      expect(indicator).toHaveAttribute('title', 'Real-time updates active');
    });

    it('should show correct tooltip for different states', () => {
      // Websocket
      mockUseSocketStatus.mockReturnValue({
        isConnected: true,
        isPolling: false,
        connectionType: 'websocket'
      });

      const { container, rerender } = render(<ConnectionIndicator />);
      let indicator = container.firstChild as HTMLElement;
      expect(indicator).toHaveAttribute('title', 'Real-time updates active');

      // Polling
      mockUseSocketStatus.mockReturnValue({
        isConnected: true,
        isPolling: false,
        connectionType: 'polling'
      });

      rerender(<ConnectionIndicator />);
      indicator = container.firstChild as HTMLElement;
      expect(indicator).toHaveAttribute('title', 'Connected via polling');

      // Polling fallback
      mockUseSocketStatus.mockReturnValue({
        isConnected: false,
        isPolling: true,
        connectionType: 'disconnected'
      });

      rerender(<ConnectionIndicator />);
      indicator = container.firstChild as HTMLElement;
      expect(indicator).toHaveAttribute('title', 'Using polling fallback');

      // Disconnected
      mockUseSocketStatus.mockReturnValue({
        isConnected: false,
        isPolling: false,
        connectionType: 'disconnected'
      });

      rerender(<ConnectionIndicator />);
      indicator = container.firstChild as HTMLElement;
      expect(indicator).toHaveAttribute('title', 'No connection');
    });
  });

  describe('Custom Props', () => {
    it('should apply custom className', () => {
      mockUseSocketStatus.mockReturnValue({
        isConnected: true,
        isPolling: false,
        connectionType: 'websocket'
      });

      const { container } = render(<ConnectionIndicator className="custom-class" />);
      const indicator = container.firstChild as HTMLElement;
      
      expect(indicator).toHaveClass('custom-class');
    });
  });
});

describe('ConnectionStatus', () => {
  const mockUseSocketStatus = useSocketStatus as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render connection status with icon and message', () => {
    mockUseSocketStatus.mockReturnValue({
      isConnected: true,
      isPolling: false,
      connectionType: 'websocket'
    });

    render(<ConnectionStatus />);
    
    expect(screen.getByText('Connection Status')).toBeInTheDocument();
    expect(screen.getByText(/Real-time connection active/)).toBeInTheDocument();
  });

  it('should show correct status for different connection states', () => {
    // Websocket connection
    mockUseSocketStatus.mockReturnValue({
      isConnected: true,
      isPolling: false,
      connectionType: 'websocket'
    });

    const { rerender } = render(<ConnectionStatus />);
    expect(screen.getByText(/Real-time connection active/)).toBeInTheDocument();

    // Polling connection
    mockUseSocketStatus.mockReturnValue({
      isConnected: true,
      isPolling: false,
      connectionType: 'polling'
    });

    rerender(<ConnectionStatus />);
    expect(screen.getByText(/Connected via HTTP polling/)).toBeInTheDocument();

    // Polling fallback
    mockUseSocketStatus.mockReturnValue({
      isConnected: false,
      isPolling: true,
      connectionType: 'disconnected'
    });

    rerender(<ConnectionStatus />);
    expect(screen.getByText(/Using polling fallback/)).toBeInTheDocument();

    // Disconnected
    mockUseSocketStatus.mockReturnValue({
      isConnected: false,
      isPolling: false,
      connectionType: 'disconnected'
    });

    rerender(<ConnectionStatus />);
    expect(screen.getByText(/No connection/)).toBeInTheDocument();
  });

  it('should show appropriate status icons', () => {
    // Test different connection states and their corresponding emojis
    const states = [
      { 
        status: { isConnected: true, isPolling: false, connectionType: 'websocket' as const },
        expectedIcon: '🟢'
      },
      { 
        status: { isConnected: true, isPolling: false, connectionType: 'polling' as const },
        expectedIcon: '🟡'
      },
      { 
        status: { isConnected: false, isPolling: true, connectionType: 'disconnected' as const },
        expectedIcon: '🟠'
      },
      { 
        status: { isConnected: false, isPolling: false, connectionType: 'disconnected' as const },
        expectedIcon: '🔴'
      }
    ];

    states.forEach(({ status, expectedIcon }) => {
      mockUseSocketStatus.mockReturnValue(status);
      
      const { container, rerender } = render(<ConnectionStatus />);
      expect(container.textContent).toContain(expectedIcon);
      
      // Clean up for next iteration
      rerender(<div />);
    });
  });
});