import React from 'react';
import { useSocketStatus } from '../../hooks/useSocket';

interface ConnectionIndicatorProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ConnectionIndicator({ 
  className = '', 
  showText = false, 
  size = 'sm' 
}: ConnectionIndicatorProps) {
  const { isConnected, isPolling, connectionType } = useSocketStatus();

  const getStatusColor = () => {
    if (isConnected) {
      return connectionType === 'websocket' ? 'bg-green-500' : 'bg-yellow-500';
    }
    if (isPolling) {
      return 'bg-orange-500';
    }
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (isConnected) {
      return connectionType === 'websocket' ? 'Real-time' : 'Connected';
    }
    if (isPolling) {
      return 'Polling';
    }
    return 'Offline';
  };

  const getStatusDescription = () => {
    if (isConnected) {
      return connectionType === 'websocket' 
        ? 'Real-time updates active'
        : 'Connected via polling';
    }
    if (isPolling) {
      return 'Using polling fallback';
    }
    return 'No connection';
  };

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`} title={getStatusDescription()}>
      <div className={`rounded-full ${getStatusColor()} ${sizeClasses[size]} animate-pulse`} />
      {showText && (
        <span className={`text-gray-600 ${textSizeClasses[size]}`}>
          {getStatusText()}
        </span>
      )}
    </div>
  );
}

// Detailed connection status component
export function ConnectionStatus() {
  const { isConnected, isPolling, connectionType } = useSocketStatus();

  const getStatusIcon = () => {
    if (isConnected) {
      return connectionType === 'websocket' ? '🟢' : '🟡';
    }
    if (isPolling) {
      return '🟠';
    }
    return '🔴';
  };

  const getStatusMessage = () => {
    if (isConnected) {
      return connectionType === 'websocket' 
        ? 'Real-time connection active - timer updates instantly'
        : 'Connected via HTTP polling - timer updates every few seconds';
    }
    if (isPolling) {
      return 'Using polling fallback - timer updates may be delayed';
    }
    return 'No connection - timer data may not sync until reconnected';
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border">
      <span className="text-lg">{getStatusIcon()}</span>
      <div className="flex-1">
        <div className="font-medium text-sm text-gray-900">
          Connection Status
        </div>
        <div className="text-xs text-gray-600 mt-1">
          {getStatusMessage()}
        </div>
      </div>
    </div>
  );
}