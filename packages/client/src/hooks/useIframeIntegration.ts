import { useEffect } from 'react';
import { iframeMessenger, detectIframe } from '../utils/iframe';
import { useAppStore } from '../store/useAppStore';

/**
 * Hook to integrate iframe messaging with app functionality
 */
export const useIframeIntegration = () => {
  const { 
    timer, 
    isOffline, 
    activeView,
    setActiveView 
  } = useAppStore();

  useEffect(() => {
    if (!detectIframe()) {
      return;
    }

    // Set up message handlers for parent frame communication
    
    // Handle view change requests from parent
    iframeMessenger.onMessage('change-view', (data: { view: string }) => {
      if (['timer', 'entries', 'reports'].includes(data.view)) {
        setActiveView(data.view as any);
      }
    });

    // Handle resize requests from parent
    iframeMessenger.onMessage('resize', (data: { width?: number; height?: number }) => {
      // The iframe info hook will automatically detect size changes
      console.log('Parent requested resize:', data);
    });

    // Handle configuration updates from parent
    iframeMessenger.onMessage('config', (data: any) => {
      console.log('Received config from parent:', data);
      // Handle configuration updates like theme, user preferences, etc.
    });

    // Cleanup message handlers
    return () => {
      iframeMessenger.offMessage('change-view');
      iframeMessenger.offMessage('resize');
      iframeMessenger.offMessage('config');
    };
  }, [setActiveView]);

  // Send timer updates to parent frame
  useEffect(() => {
    if (!detectIframe() || !timer) {
      return;
    }

    const timerData = {
      isRunning: timer.isRunning,
      elapsedTime: timer.elapsedTime,
      projectName: timer.projectId, // We'll need to get project name separately
      description: timer.description,
      startTime: timer.startTime,
    };

    iframeMessenger.notifyTimerUpdate(timerData);
  }, [timer]);

  // Send offline status updates to parent frame
  useEffect(() => {
    if (!detectIframe()) {
      return;
    }

    if (isOffline) {
      iframeMessenger.notify('Application is offline - working in offline mode', 'warning');
    } else {
      iframeMessenger.notify('Application is online - syncing data', 'success');
    }
  }, [isOffline]);

  // Send view change notifications to parent frame
  useEffect(() => {
    if (!detectIframe()) {
      return;
    }

    // Send view change as a notification instead
    iframeMessenger.notify(`Switched to ${activeView} view`, 'info');
  }, [activeView]);

  return {
    isInIframe: detectIframe(),
    sendNotification: (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
      if (detectIframe()) {
        iframeMessenger.notify(message, type);
      }
    },
    requestResize: (width?: number, height?: number) => {
      if (detectIframe()) {
        iframeMessenger.requestResize(width, height);
      }
    },
  };
};