import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../store/useAppStore';
import { timerApi, TimeEntry, isApiError } from '../../lib/api';
import { formatElapsedTime, calculateElapsedTime } from '../../lib/timeUtils';
import { useIframeSize } from '../../hooks/useIframeSize';
import { useSocket } from '../../hooks/useSocket';
import { useIframeIntegration } from '../../hooks/useIframeIntegration';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ConnectionIndicator } from '../ui/ConnectionIndicator';

interface TimerWidgetProps {
  className?: string;
  compact?: boolean; // For different iframe sizes
}

export const TimerWidget: React.FC<TimerWidgetProps> = ({ className = '', compact: forcedCompact = false }) => {
  const queryClient = useQueryClient();
  const { timer, startTimer, stopTimer, updateTimer, resetTimer, isOffline } = useAppStore();
  const { isCompact, isVeryCompact } = useIframeSize();
  
  // Use forced compact mode or auto-detect based on iframe size
  const compact = forcedCompact || isCompact;
  const [localElapsedTime, setLocalElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [conflictingEntry, setConflictingEntry] = useState<TimeEntry | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Iframe integration for parent frame communication
  const { isInIframe, sendNotification } = useIframeIntegration();

  // Real-time socket connection
  const {
    isConnected: isSocketConnected,
    isPolling,
    connectionType,
    startTimer: socketStartTimer,
    stopTimer: socketStopTimer,
    pauseTimer: socketPauseTimer,
    syncTimer: socketSyncTimer,
  } = useSocket({
    onTimerStarted: (data) => {
      console.log('Timer started via socket:', data);
      if (data.timerId && data.projectId) {
        startTimer(data.projectId, data.description || '');
        setLocalElapsedTime(data.elapsedTime || 0);
        setError(null);
        queryClient.invalidateQueries({ queryKey: ['timer'] });
      }
    },
    onTimerStopped: (data) => {
      console.log('Timer stopped via socket:', data);
      stopTimer();
      setLocalElapsedTime(0);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['timer'] });
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    },
    onTimerPaused: (data) => {
      console.log('Timer paused via socket:', data);
      stopTimer();
      setLocalElapsedTime(data.elapsedTime || 0);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['timer'] });
    },
    onTimerUpdate: (data) => {
      console.log('Timer update via socket:', data);
      if (data.isRunning && data.projectId) {
        if (!timer.isRunning) {
          startTimer(data.projectId, data.description || '');
        }
        setLocalElapsedTime(data.elapsedTime || 0);
      } else if (!data.isRunning && timer.isRunning) {
        stopTimer();
        setLocalElapsedTime(0);
      }
    },
    onTimerState: (data) => {
      console.log('Timer state via socket:', data);
      if (data.isRunning && data.timer) {
        if (!timer.isRunning) {
          startTimer(data.timer.projectId, data.timer.description || '');
        }
        const elapsed = Math.floor((Date.now() - new Date(data.timer.startTime).getTime()) / 1000);
        setLocalElapsedTime(elapsed);
      } else if (!data.isRunning && timer.isRunning) {
        resetTimer();
        setLocalElapsedTime(0);
      }
    },
    onTimeEntryCreated: (data) => {
      console.log('Time entry created via socket:', data);
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    },
    onError: (error) => {
      console.error('Socket timer error:', error);
      setError(error.message);
    },
    onConnect: () => {
      console.log('Socket connected, syncing timer state');
      socketSyncTimer();
    },
    onReconnect: () => {
      console.log('Socket reconnected, syncing timer state');
      socketSyncTimer();
    },
    autoConnect: true,
  });

  // Query for active timer state
  const { data: timerState, isLoading: isLoadingState } = useQuery({
    queryKey: ['timer', 'state'],
    queryFn: timerApi.getState,
    refetchInterval: isOffline ? false : 5000, // Sync every 5 seconds when online
    enabled: !isOffline,
  });

  // Start timer mutation
  const startMutation = useMutation({
    mutationFn: timerApi.start,
    onSuccess: (data) => {
      const entry = data.timeEntry;
      startTimer(entry.projectId, entry.description);
      setLocalElapsedTime(0);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['timer'] });
    },
    onError: (error) => {
      if (isApiError(error) && error.response?.data?.error?.code === 'TIMER_CONFLICT') {
        const conflictData = error.response.data.error.details?.conflictingEntry;
        if (conflictData) {
          setConflictingEntry(conflictData);
          setError('Another timer is already running. Please resolve the conflict.');
          return;
        }
      }
      
      if (isApiError(error)) {
        setError(error.response?.data?.error?.message || 'Failed to start timer');
      } else {
        setError('Failed to start timer');
      }
    },
  });

  // Stop timer mutation
  const stopMutation = useMutation({
    mutationFn: timerApi.stop,
    onSuccess: () => {
      stopTimer();
      setLocalElapsedTime(0);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['timer'] });
    },
    onError: (error) => {
      if (isApiError(error)) {
        setError(error.response?.data?.error?.message || 'Failed to stop timer');
      } else {
        setError('Failed to stop timer');
      }
    },
  });

  // Pause timer mutation
  const pauseMutation = useMutation({
    mutationFn: timerApi.pause,
    onSuccess: () => {
      stopTimer();
      setLocalElapsedTime(0);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['timer'] });
    },
    onError: (error) => {
      if (isApiError(error)) {
        setError(error.response?.data?.error?.message || 'Failed to pause timer');
      } else {
        setError('Failed to pause timer');
      }
    },
  });

  // Resolve conflict mutation
  const resolveConflictMutation = useMutation({
    mutationFn: timerApi.resolveConflict,
    onSuccess: () => {
      setConflictingEntry(null);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['timer'] });
    },
    onError: (error) => {
      if (isApiError(error)) {
        setError(error.response?.data?.error?.message || 'Failed to resolve conflict');
      } else {
        setError('Failed to resolve conflict');
      }
    },
  });

  // Update local elapsed time when timer is running
  useEffect(() => {
    if (timer.isRunning && timer.startTime) {
      const updateElapsed = () => {
        const elapsed = calculateElapsedTime(timer.startTime!);
        setLocalElapsedTime(elapsed);
        updateTimer(elapsed);
      };

      // Update immediately
      updateElapsed();

      // Then update every second
      intervalRef.current = setInterval(updateElapsed, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setLocalElapsedTime(timer.elapsedTime);
    }
  }, [timer.isRunning, timer.startTime, timer.elapsedTime, updateTimer]);

  // Sync with server state
  useEffect(() => {
    if (timerState && !isOffline) {
      if (timerState.isRunning && timerState.currentEntry) {
        if (!timer.isRunning) {
          // Server has running timer but local doesn't - sync local state
          startTimer(timerState.currentEntry.projectId, timerState.currentEntry.description);
        }
        setLocalElapsedTime(timerState.elapsedTime);
      } else if (!timerState.isRunning && timer.isRunning) {
        // Server stopped but local is still running - sync local state
        resetTimer();
        setLocalElapsedTime(0);
      }
    }
  }, [timerState, timer.isRunning, startTimer, resetTimer, isOffline]);

  // Define handlers first
  const handleStart = useCallback(() => {
    if (!timer.projectId) {
      setError('Please select a project first');
      return;
    }
    
    // Use socket if connected, otherwise fall back to HTTP API
    if (isSocketConnected) {
      socketStartTimer(timer.projectId, timer.description);
    } else {
      startMutation.mutate({
        projectId: timer.projectId,
        description: timer.description,
      });
    }
  }, [timer.projectId, timer.description, isSocketConnected, socketStartTimer, startMutation]);

  const handleStop = useCallback(() => {
    // Use socket if connected, otherwise fall back to HTTP API
    if (isSocketConnected) {
      socketStopTimer();
    } else {
      stopMutation.mutate({});
    }
  }, [isSocketConnected, socketStopTimer, stopMutation]);

  const handlePause = useCallback(() => {
    // Use socket if connected, otherwise fall back to HTTP API
    if (isSocketConnected) {
      socketPauseTimer();
    } else {
      pauseMutation.mutate();
    }
  }, [isSocketConnected, socketPauseTimer, pauseMutation]);

  // Keyboard shortcuts with enhanced functionality
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input and widget is focused or contains focus
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Check if the widget or its children have focus
      const widgetElement = widgetRef.current;
      if (!widgetElement || (!widgetElement.contains(document.activeElement) && document.activeElement !== document.body)) {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 'enter':
            event.preventDefault();
            if (timer.isRunning) {
              handleStop();
            } else {
              handleStart();
            }
            break;
          case ' ':
            event.preventDefault();
            if (timer.isRunning) {
              handlePause();
            }
            break;
          case '?':
            event.preventDefault();
            setShowKeyboardHelp(!showKeyboardHelp);
            break;
        }
      }
      
      // Space bar for start/pause (without modifier)
      if (event.key === ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        if (timer.isRunning) {
          handlePause();
        } else if (timer.projectId) {
          handleStart();
        }
      }
      
      // Escape to clear errors or close help
      if (event.key === 'Escape') {
        if (showKeyboardHelp) {
          setShowKeyboardHelp(false);
        } else if (error) {
          setError(null);
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [timer.isRunning, timer.projectId, showKeyboardHelp, error, handleStart, handleStop, handlePause]);

  const handleResolveConflict = useCallback((action: 'stop_existing' | 'cancel_new') => {
    resolveConflictMutation.mutate(action);
  }, [resolveConflictMutation]);

  const isLoading = startMutation.isPending || stopMutation.isPending || pauseMutation.isPending || resolveConflictMutation.isPending;

  // Get timer state for display with enhanced visual feedback
  const displayElapsedTime = timer.isRunning ? localElapsedTime : timer.elapsedTime;
  const getTimerStateDisplay = () => {
    if (timer.isRunning) {
      return {
        text: 'Running',
        className: 'text-green-600',
        indicatorClass: 'bg-green-500 animate-pulse',
        bgClass: 'bg-green-50 border-green-200',
      };
    } else if (timer.elapsedTime > 0) {
      return {
        text: 'Paused',
        className: 'text-yellow-600',
        indicatorClass: 'bg-yellow-500',
        bgClass: 'bg-yellow-50 border-yellow-200',
      };
    } else {
      return {
        text: 'Stopped',
        className: 'text-gray-600',
        indicatorClass: 'bg-gray-400',
        bgClass: 'bg-white border-gray-200',
      };
    }
  };

  const timerDisplayState = getTimerStateDisplay();

  return (
    <div 
      ref={widgetRef}
      className={`${timerDisplayState.bgClass} rounded-lg shadow-sm border transition-all duration-300 ${
        compact ? 'p-2' : 'p-4'
      } ${className}`}
      tabIndex={0}
      role="region"
      aria-label="Timer Widget"
    >
      {/* Timer Display */}
      <div className="text-center mb-4">
        <div 
          className={`font-mono font-bold text-gray-900 mb-2 transition-all duration-200 select-none ${
            isVeryCompact ? 'text-xl' : compact ? 'text-2xl' : 'text-3xl md:text-4xl'
          } ${timer.isRunning ? 'animate-pulse' : ''}`}
          role="timer"
          aria-live="polite"
          aria-label={`Timer: ${formatElapsedTime(displayElapsedTime)}`}
        >
          {formatElapsedTime(displayElapsedTime)}
        </div>
        <div className={`${compact ? 'text-xs' : 'text-sm'} font-medium ${timerDisplayState.className} flex items-center justify-center gap-2 transition-all duration-300`}>
          <div className={`${compact ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full ${timerDisplayState.indicatorClass} transition-all duration-300`} />
          <span className="capitalize">{timerDisplayState.text}</span>
          {isOffline && (
            <span className="text-orange-500 text-xs font-semibold bg-orange-100 px-1 rounded">
              Offline
            </span>
          )}
          {isLoading && (
            <div className="w-3 h-3">
              <LoadingSpinner size="sm" />
            </div>
          )}
          {/* Connection indicator */}
          <ConnectionIndicator 
            size={compact ? 'sm' : 'md'} 
            className="ml-1"
          />
        </div>
        
        {/* Progress indicator for running timer */}
        {timer.isRunning && (
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-1">
              <div 
                className="bg-green-500 h-1 rounded-full transition-all duration-1000 ease-linear"
                style={{ 
                  width: `${Math.min(100, (displayElapsedTime % 60) * (100 / 60))}%` 
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Conflict Resolution */}
      {conflictingEntry && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md animate-in slide-in-from-top duration-300">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className={`${compact ? 'text-xs' : 'text-sm'} text-yellow-800 mb-3`}>
                Another timer is running for project "{conflictingEntry.projectId}". 
                What would you like to do?
              </p>
              <div className={`flex gap-2 ${compact ? 'flex-col' : ''}`}>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleResolveConflict('stop_existing')}
                  disabled={isLoading}
                  className={compact ? 'w-full' : ''}
                >
                  Stop Existing Timer
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleResolveConflict('cancel_new')}
                  disabled={isLoading}
                  className={compact ? 'w-full' : ''}
                >
                  Cancel New Timer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timer Controls */}
      <div className={`flex gap-2 justify-center ${compact ? 'flex-col' : ''}`}>
        {!timer.isRunning ? (
          <Button
            onClick={handleStart}
            disabled={isLoading || !timer.projectId}
            loading={startMutation.isPending}
            className={`${compact ? 'w-full' : 'flex-1 max-w-32'} transition-all duration-200 hover:scale-105 active:scale-95`}
            size={compact ? 'sm' : 'md'}
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Start Timer
          </Button>
        ) : (
          <div className={`flex gap-2 ${compact ? 'flex-col' : ''} w-full justify-center`}>
            <Button
              onClick={handleStop}
              disabled={isLoading}
              loading={stopMutation.isPending}
              variant="danger"
              className={`${compact ? 'w-full' : 'flex-1 max-w-24'} transition-all duration-200 hover:scale-105 active:scale-95`}
              size={compact ? 'sm' : 'md'}
            >
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              </svg>
              Stop
            </Button>
            <Button
              onClick={handlePause}
              disabled={isLoading}
              loading={pauseMutation.isPending}
              variant="secondary"
              className={`${compact ? 'w-full' : 'flex-1 max-w-24'} transition-all duration-200 hover:scale-105 active:scale-95`}
              size={compact ? 'sm' : 'md'}
            >
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Pause
            </Button>
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Help */}
      {!compact && (
        <div className="mt-4 text-xs text-gray-500 text-center">
          <button
            onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
            className="hover:text-gray-700 transition-colors duration-200 underline decoration-dotted"
            aria-expanded={showKeyboardHelp}
          >
            Keyboard Shortcuts
          </button>
          {showKeyboardHelp && (
            <div className="mt-2 p-2 bg-gray-50 rounded border text-left">
              <div className="space-y-1">
                <div><kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Space</kbd> Start/Pause</div>
                <div><kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Ctrl+Enter</kbd> Start/Stop</div>
                <div><kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Ctrl+Space</kbd> Pause</div>
                <div><kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Escape</kbd> Clear errors</div>
                <div><kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Ctrl+?</kbd> Toggle help</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions for Compact Mode */}
      {compact && !timer.isRunning && (
        <div className="mt-2 flex justify-center">
          <button
            onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors duration-200"
            aria-label="Show keyboard shortcuts"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoadingState && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg backdrop-blur-sm">
          <div className="text-center">
            <LoadingSpinner size="sm" />
            <p className="text-xs text-gray-600 mt-2">Syncing timer state...</p>
          </div>
        </div>
      )}

      {/* Focus indicator for keyboard navigation */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {timer.isRunning ? `Timer running: ${formatElapsedTime(displayElapsedTime)}` : 'Timer stopped'}
      </div>
    </div>
  );
};