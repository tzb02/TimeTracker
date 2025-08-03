import React, { useState, useEffect } from 'react';
import { syncManager, SyncResult } from '../../utils/syncManager';

interface OfflineIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ 
  className = '', 
  showDetails = false 
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [showSyncDetails, setShowSyncDetails] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for sync events
    const handleSyncResult = (result: SyncResult) => {
      setIsSyncing(false);
      setLastSyncResult(result);
    };

    syncManager.onSync(handleSyncResult);

    // Check if sync is in progress
    setIsSyncing(syncManager.isSyncInProgress());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      syncManager.offSync(handleSyncResult);
    };
  }, []);

  const handleSyncClick = async () => {
    if (!isOnline || isSyncing) return;
    
    setIsSyncing(true);
    try {
      await syncManager.triggerSync();
    } catch (error) {
      console.error('Manual sync failed:', error);
      setIsSyncing(false);
    }
  };

  const getStatusColor = () => {
    if (isSyncing) return 'text-yellow-600 bg-yellow-100';
    if (!isOnline) return 'text-red-600 bg-red-100';
    if (lastSyncResult && !lastSyncResult.success) return 'text-orange-600 bg-orange-100';
    return 'text-green-600 bg-green-100';
  };

  const getStatusText = () => {
    if (isSyncing) return 'Syncing...';
    if (!isOnline) return 'Offline';
    if (lastSyncResult && !lastSyncResult.success) return 'Sync Issues';
    return 'Online';
  };

  const getStatusIcon = () => {
    if (isSyncing) {
      return (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      );
    }
    
    if (!isOnline) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728m0 0L5.636 18.364m12.728-12.728L18.364 18.364M12 2.25c5.385 0 9.75 4.365 9.75 9.75s-4.365 9.75-9.75 9.75S2.25 17.635 2.25 12 6.615 2.25 12 2.25z" />
        </svg>
      );
    }
    
    if (lastSyncResult && !lastSyncResult.success) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      );
    }
    
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium cursor-pointer transition-colors ${getStatusColor()}`}
        onClick={() => setShowSyncDetails(!showSyncDetails)}
        title={`Status: ${getStatusText()}${isOnline && !isSyncing ? ' - Click to sync' : ''}`}
      >
        {getStatusIcon()}
        <span>{getStatusText()}</span>
        {!isOnline && (
          <span className="text-xs opacity-75">
            (Changes saved locally)
          </span>
        )}
      </div>

      {/* Sync Details Dropdown */}
      {showDetails && showSyncDetails && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Sync Status</h3>
              <button
                onClick={() => setShowSyncDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Connection:</span>
                <span className={`text-sm font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              {lastSyncResult && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Last Sync:</span>
                    <span className={`text-sm font-medium ${lastSyncResult.success ? 'text-green-600' : 'text-red-600'}`}>
                      {lastSyncResult.success ? 'Success' : 'Failed'}
                    </span>
                  </div>

                  {lastSyncResult.synced > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Items Synced:</span>
                      <span className="text-sm font-medium text-blue-600">
                        {lastSyncResult.synced}
                      </span>
                    </div>
                  )}

                  {lastSyncResult.conflicts > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Conflicts:</span>
                      <span className="text-sm font-medium text-orange-600">
                        {lastSyncResult.conflicts}
                      </span>
                    </div>
                  )}

                  {lastSyncResult.failed > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Failed:</span>
                      <span className="text-sm font-medium text-red-600">
                        {lastSyncResult.failed}
                      </span>
                    </div>
                  )}

                  {lastSyncResult.errors.length > 0 && (
                    <div className="mt-3">
                      <span className="text-sm text-gray-600 block mb-1">Errors:</span>
                      <div className="max-h-20 overflow-y-auto">
                        {lastSyncResult.errors.map((error, index) => (
                          <div key={index} className="text-xs text-red-600 bg-red-50 p-1 rounded mb-1">
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {isOnline && !isSyncing && (
                <button
                  onClick={handleSyncClick}
                  className="w-full mt-3 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  Sync Now
                </button>
              )}

              {!isOnline && (
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-xs text-yellow-800">
                    You're offline. Changes are being saved locally and will sync when you're back online.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator;