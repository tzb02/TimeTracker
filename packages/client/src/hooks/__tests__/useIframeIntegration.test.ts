import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIframeIntegration } from '../useIframeIntegration';
import * as iframeUtils from '../../utils/iframe';
import { useAppStore } from '../../store/useAppStore';

// Mock the iframe utilities
vi.mock('../../utils/iframe', () => ({
  detectIframe: vi.fn(),
  iframeMessenger: {
    onMessage: vi.fn(),
    offMessage: vi.fn(),
    notifyTimerUpdate: vi.fn(),
    notify: vi.fn(),
    sendToParent: vi.fn(),
    requestResize: vi.fn(),
  },
}));

// Mock the app store
vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

describe('useIframeIntegration', () => {
  const mockSetActiveView = vi.fn();
  const mockCurrentTimer = {
    isRunning: true,
    elapsedTime: 120,
    startTime: new Date(),
    currentEntry: {
      project: { name: 'Test Project' },
      description: 'Test task',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock useAppStore return value
    (useAppStore as any).mockReturnValue({
      currentTimer: mockCurrentTimer,
      isOffline: false,
      activeView: 'timer',
      setActiveView: mockSetActiveView,
    });

    // Mock detectIframe to return true by default
    (iframeUtils.detectIframe as any).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should set up message handlers when in iframe', () => {
    renderHook(() => useIframeIntegration());

    expect(iframeUtils.iframeMessenger.onMessage).toHaveBeenCalledWith(
      'change-view',
      expect.any(Function)
    );
    expect(iframeUtils.iframeMessenger.onMessage).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    );
    expect(iframeUtils.iframeMessenger.onMessage).toHaveBeenCalledWith(
      'config',
      expect.any(Function)
    );
  });

  it('should handle view change messages from parent', () => {
    const { result } = renderHook(() => useIframeIntegration());

    // Get the change-view handler
    const changeViewHandler = (iframeUtils.iframeMessenger.onMessage as any).mock.calls
      .find((call: any) => call[0] === 'change-view')?.[1];

    expect(changeViewHandler).toBeDefined();

    // Simulate receiving a view change message
    act(() => {
      changeViewHandler({ view: 'entries' });
    });

    expect(mockSetActiveView).toHaveBeenCalledWith('entries');
  });

  it('should ignore invalid view change requests', () => {
    renderHook(() => useIframeIntegration());

    const changeViewHandler = (iframeUtils.iframeMessenger.onMessage as any).mock.calls
      .find((call: any) => call[0] === 'change-view')?.[1];

    act(() => {
      changeViewHandler({ view: 'invalid-view' });
    });

    expect(mockSetActiveView).not.toHaveBeenCalled();
  });

  it('should send timer updates to parent frame', () => {
    renderHook(() => useIframeIntegration());

    expect(iframeUtils.iframeMessenger.notifyTimerUpdate).toHaveBeenCalledWith({
      isRunning: true,
      elapsedTime: 120,
      projectName: 'Test Project',
      description: 'Test task',
      startTime: mockCurrentTimer.startTime,
    });
  });

  it('should send offline status updates to parent frame', () => {
    // Test offline status
    (useAppStore as any).mockReturnValue({
      currentTimer: mockCurrentTimer,
      isOffline: true,
      activeView: 'timer',
      setActiveView: mockSetActiveView,
    });

    renderHook(() => useIframeIntegration());

    expect(iframeUtils.iframeMessenger.notify).toHaveBeenCalledWith(
      'Application is offline - working in offline mode',
      'warning'
    );
  });

  it('should send online status updates to parent frame', () => {
    // Test online status
    (useAppStore as any).mockReturnValue({
      currentTimer: mockCurrentTimer,
      isOffline: false,
      activeView: 'timer',
      setActiveView: mockSetActiveView,
    });

    renderHook(() => useIframeIntegration());

    expect(iframeUtils.iframeMessenger.notify).toHaveBeenCalledWith(
      'Application is online - syncing data',
      'success'
    );
  });

  it('should send view change notifications to parent frame', () => {
    renderHook(() => useIframeIntegration());

    expect(iframeUtils.iframeMessenger.sendToParent).toHaveBeenCalledWith({
      type: 'view-changed',
      data: { view: 'timer' }
    });
  });

  it('should clean up message handlers on unmount', () => {
    const { unmount } = renderHook(() => useIframeIntegration());

    unmount();

    expect(iframeUtils.iframeMessenger.offMessage).toHaveBeenCalledWith('change-view');
    expect(iframeUtils.iframeMessenger.offMessage).toHaveBeenCalledWith('resize');
    expect(iframeUtils.iframeMessenger.offMessage).toHaveBeenCalledWith('config');
  });

  it('should not set up handlers when not in iframe', () => {
    (iframeUtils.detectIframe as any).mockReturnValue(false);

    renderHook(() => useIframeIntegration());

    expect(iframeUtils.iframeMessenger.onMessage).not.toHaveBeenCalled();
  });

  it('should return correct iframe status and utility functions', () => {
    const { result } = renderHook(() => useIframeIntegration());

    expect(result.current.isInIframe).toBe(true);
    expect(typeof result.current.sendNotification).toBe('function');
    expect(typeof result.current.requestResize).toBe('function');
  });

  it('should send notifications when in iframe', () => {
    const { result } = renderHook(() => useIframeIntegration());

    act(() => {
      result.current.sendNotification('Test message', 'info');
    });

    expect(iframeUtils.iframeMessenger.notify).toHaveBeenCalledWith('Test message', 'info');
  });

  it('should request resize when in iframe', () => {
    const { result } = renderHook(() => useIframeIntegration());

    act(() => {
      result.current.requestResize(400, 300);
    });

    expect(iframeUtils.iframeMessenger.requestResize).toHaveBeenCalledWith(400, 300);
  });

  it('should not send notifications when not in iframe', () => {
    (iframeUtils.detectIframe as any).mockReturnValue(false);
    
    const { result } = renderHook(() => useIframeIntegration());

    act(() => {
      result.current.sendNotification('Test message', 'info');
    });

    expect(iframeUtils.iframeMessenger.notify).not.toHaveBeenCalled();
  });
});