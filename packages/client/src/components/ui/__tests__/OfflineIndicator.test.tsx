import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OfflineIndicator } from '../OfflineIndicator';
import { syncManager } from '../../../utils/syncManager';

// Mock dependencies
vi.mock('../../../utils/syncManager');

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

describe('OfflineIndicator Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigator.onLine = true;
    
    // Mock sync manager methods
    vi.mocked(syncManager.isSyncInProgress).mockReturnValue(false);
    vi.mocked(syncManager.onSync).mockImplementation(() => {});
    vi.mocked(syncManager.offSync).mockImplementation(() => {});
    vi.mocked(syncManager.triggerSync).mockResolvedValue({
      success: true,
      synced: 0,
      failed: 0,
      conflicts: 0,
      errors: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Online Status Display', () => {
    it('should show online status when connected', () => {
      render(<OfflineIndicator />);
      
      expect(screen.getByText('Online')).toBeInTheDocument();
      expect(screen.getByTitle(/Status: Online/)).toBeInTheDocument();
    });

    it('should show offline status when disconnected', () => {
      navigator.onLine = false;
      
      render(<OfflineIndicator />);
      
      fireEvent(window, new Event('offline'));
      
      expect(screen.getByText('Offline')).toBeInTheDocument();
      expect(screen.getByText('(Changes saved locally)')).toBeInTheDocument();
    });

    it('should show syncing status when sync is in progress', () => {
      vi.mocked(syncManager.isSyncInProgress).mockReturnValue(true);
      
      render(<OfflineIndicator />);
      
      expect(screen.getByText('Syncing...')).toBeInTheDocument();
    });
  });

  describe('Status Colors', () => {
    it('should use green color for online status', () => {
      render(<OfflineIndicator />);
      
      const indicator = screen.getByText('Online').closest('div');
      expect(indicator).toHaveClass('text-green-600', 'bg-green-100');
    });

    it('should use red color for offline status', () => {
      navigator.onLine = false;
      
      render(<OfflineIndicator />);
      
      fireEvent(window, new Event('offline'));
      
      const indicator = screen.getByText('Offline').closest('div');
      expect(indicator).toHaveClass('text-red-600', 'bg-red-100');
    });

    it('should use yellow color for syncing status', () => {
      vi.mocked(syncManager.isSyncInProgress).mockReturnValue(true);
      
      render(<OfflineIndicator />);
      
      const indicator = screen.getByText('Syncing...').closest('div');
      expect(indicator).toHaveClass('text-yellow-600', 'bg-yellow-100');
    });

    it('should use orange color for sync issues', () => {
      const { rerender } = render(<OfflineIndicator />);
      
      // Simulate sync result with errors
      const mockSyncResult = {
        success: false,
        synced: 0,
        failed: 1,
        conflicts: 0,
        errors: ['Network error'],
      };
      
      // Trigger sync result
      const onSyncCallback = vi.mocked(syncManager.onSync).mock.calls[0][0];
      onSyncCallback(mockSyncResult);
      
      rerender(<OfflineIndicator />);
      
      const indicator = screen.getByText('Sync Issues').closest('div');
      expect(indicator).toHaveClass('text-orange-600', 'bg-orange-100');
    });
  });

  describe('Status Icons', () => {
    it('should show spinning icon when syncing', () => {
      vi.mocked(syncManager.isSyncInProgress).mockReturnValue(true);
      
      render(<OfflineIndicator />);
      
      const spinningIcon = document.querySelector('.animate-spin');
      expect(spinningIcon).toBeInTheDocument();
    });

    it('should show offline icon when disconnected', () => {
      navigator.onLine = false;
      
      render(<OfflineIndicator />);
      
      fireEvent(window, new Event('offline'));
      
      // Check for offline icon (circle with slash)
      const offlineIcon = document.querySelector('svg path[d*="18.364"]');
      expect(offlineIcon).toBeInTheDocument();
    });

    it('should show warning icon for sync issues', () => {
      const { rerender } = render(<OfflineIndicator />);
      
      // Simulate sync result with errors
      const mockSyncResult = {
        success: false,
        synced: 0,
        failed: 1,
        conflicts: 0,
        errors: ['Network error'],
      };
      
      const onSyncCallback = vi.mocked(syncManager.onSync).mock.calls[0][0];
      onSyncCallback(mockSyncResult);
      
      rerender(<OfflineIndicator />);
      
      // Check for warning icon
      const warningIcon = document.querySelector('svg path[d*="12 9v2m0 4h.01"]');
      expect(warningIcon).toBeInTheDocument();
    });

    it('should show check icon when online and synced', () => {
      render(<OfflineIndicator />);
      
      // Check for check circle icon
      const checkIcon = document.querySelector('svg path[d*="9 12l2 2 4-4"]');
      expect(checkIcon).toBeInTheDocument();
    });
  });

  describe('Sync Details Dropdown', () => {
    it('should show sync details when showDetails is true and clicked', () => {
      render(<OfflineIndicator showDetails={true} />);
      
      const indicator = screen.getByText('Online');
      fireEvent.click(indicator);
      
      expect(screen.getByText('Sync Status')).toBeInTheDocument();
      expect(screen.getByText('Connection:')).toBeInTheDocument();
    });

    it('should not show sync details when showDetails is false', () => {
      render(<OfflineIndicator showDetails={false} />);
      
      const indicator = screen.getByText('Online');
      fireEvent.click(indicator);
      
      expect(screen.queryByText('Sync Status')).not.toBeInTheDocument();
    });

    it('should close sync details when close button is clicked', () => {
      render(<OfflineIndicator showDetails={true} />);
      
      const indicator = screen.getByText('Online');
      fireEvent.click(indicator);
      
      expect(screen.getByText('Sync Status')).toBeInTheDocument();
      
      const closeButton = screen.getByRole('button');
      fireEvent.click(closeButton);
      
      expect(screen.queryByText('Sync Status')).not.toBeInTheDocument();
    });

    it('should display sync statistics in details', () => {
      const { rerender } = render(<OfflineIndicator showDetails={true} />);
      
      // Simulate sync result with statistics
      const mockSyncResult = {
        success: true,
        synced: 5,
        failed: 1,
        conflicts: 2,
        errors: ['Network timeout', 'Server error'],
      };
      
      const onSyncCallback = vi.mocked(syncManager.onSync).mock.calls[0][0];
      onSyncCallback(mockSyncResult);
      
      rerender(<OfflineIndicator showDetails={true} />);
      
      const indicator = screen.getByText('Online');
      fireEvent.click(indicator);
      
      expect(screen.getByText('5')).toBeInTheDocument(); // synced count
      expect(screen.getByText('1')).toBeInTheDocument(); // failed count
      expect(screen.getByText('2')).toBeInTheDocument(); // conflicts count
      expect(screen.getByText('Network timeout')).toBeInTheDocument();
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });

    it('should show sync now button when online and not syncing', () => {
      render(<OfflineIndicator showDetails={true} />);
      
      const indicator = screen.getByText('Online');
      fireEvent.click(indicator);
      
      expect(screen.getByText('Sync Now')).toBeInTheDocument();
    });

    it('should not show sync now button when offline', () => {
      navigator.onLine = false;
      
      render(<OfflineIndicator showDetails={true} />);
      
      fireEvent(window, new Event('offline'));
      
      const indicator = screen.getByText('Offline');
      fireEvent.click(indicator);
      
      expect(screen.queryByText('Sync Now')).not.toBeInTheDocument();
      expect(screen.getByText(/You're offline/)).toBeInTheDocument();
    });

    it('should not show sync now button when syncing', () => {
      vi.mocked(syncManager.isSyncInProgress).mockReturnValue(true);
      
      render(<OfflineIndicator showDetails={true} />);
      
      const indicator = screen.getByText('Syncing...');
      fireEvent.click(indicator);
      
      expect(screen.queryByText('Sync Now')).not.toBeInTheDocument();
    });
  });

  describe('Manual Sync', () => {
    it('should trigger sync when sync now button is clicked', async () => {
      render(<OfflineIndicator showDetails={true} />);
      
      const indicator = screen.getByText('Online');
      fireEvent.click(indicator);
      
      const syncButton = screen.getByText('Sync Now');
      fireEvent.click(syncButton);
      
      await waitFor(() => {
        expect(syncManager.triggerSync).toHaveBeenCalled();
      });
    });

    it('should not trigger sync when offline', async () => {
      navigator.onLine = false;
      
      render(<OfflineIndicator showDetails={true} />);
      
      fireEvent(window, new Event('offline'));
      
      const indicator = screen.getByText('Offline');
      fireEvent.click(indicator);
      
      // No sync button should be present
      expect(screen.queryByText('Sync Now')).not.toBeInTheDocument();
    });

    it('should not trigger sync when already syncing', async () => {
      vi.mocked(syncManager.isSyncInProgress).mockReturnValue(true);
      
      render(<OfflineIndicator showDetails={true} />);
      
      const indicator = screen.getByText('Syncing...');
      fireEvent.click(indicator);
      
      // No sync button should be present
      expect(screen.queryByText('Sync Now')).not.toBeInTheDocument();
    });
  });

  describe('Network Event Handling', () => {
    it('should update status when going online', () => {
      navigator.onLine = false;
      
      const { rerender } = render(<OfflineIndicator />);
      
      fireEvent(window, new Event('offline'));
      expect(screen.getByText('Offline')).toBeInTheDocument();
      
      navigator.onLine = true;
      fireEvent(window, new Event('online'));
      rerender(<OfflineIndicator />);
      
      expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('should update status when going offline', () => {
      render(<OfflineIndicator />);
      
      expect(screen.getByText('Online')).toBeInTheDocument();
      
      navigator.onLine = false;
      fireEvent(window, new Event('offline'));
      
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<OfflineIndicator />);
      
      const indicator = screen.getByText('Online').closest('div');
      expect(indicator).toHaveAttribute('title');
    });

    it('should be keyboard accessible', () => {
      render(<OfflineIndicator showDetails={true} />);
      
      const indicator = screen.getByText('Online').closest('div');
      expect(indicator).toHaveClass('cursor-pointer');
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      render(<OfflineIndicator className="custom-class" />);
      
      const container = screen.getByText('Online').closest('.custom-class');
      expect(container).toBeInTheDocument();
    });
  });
});