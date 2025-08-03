import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useIframeInfo, iframeMessenger, IframeFallbacks } from '../../utils/iframe';

interface IframeLayoutProps {
  children: React.ReactNode;
}

export const IframeLayout: React.FC<IframeLayoutProps> = ({ children }) => {
  const { isOffline } = useAppStore();
  const iframeInfo = useIframeInfo();
  const [hasRestrictions, setHasRestrictions] = useState(false);

  useEffect(() => {
    // Check for iframe restrictions and set up fallbacks
    const restrictions = iframeInfo.restrictions;
    const hasAnyRestrictions = !restrictions.localStorage || 
                              !restrictions.sessionStorage || 
                              !restrictions.webSocket || 
                              !restrictions.notifications;
    
    setHasRestrictions(hasAnyRestrictions);

    // Set up fallbacks for blocked features
    if (!restrictions.localStorage) {
      console.warn('localStorage blocked in iframe, using memory storage fallback');
      // Note: This would require more complex implementation to replace localStorage globally
    }

    if (!restrictions.webSocket) {
      console.warn('WebSocket blocked in iframe, polling fallback will be used');
    }

    if (!restrictions.notifications) {
      console.warn('Notifications blocked in iframe, using parent frame messaging');
    }

    // Notify parent frame that the app is ready
    if (iframeInfo.isInIframe) {
      iframeMessenger.notifyReady();
    }
  }, [iframeInfo]);

  // Enhanced dynamic height calculation based on content
  const getContainerHeight = () => {
    const height = iframeInfo.dimensions.height;
    
    if (height < 300) {
      return 'min-h-[250px] max-h-[280px]';
    } else if (height < 400) {
      return 'min-h-[300px] max-h-[380px]';
    } else if (height < 500) {
      return 'min-h-[400px] max-h-[480px]';
    } else if (height < 600) {
      return 'min-h-[500px] max-h-[580px]';
    } else {
      return 'min-h-[600px] max-h-[800px]';
    }
  };

  // Enhanced dynamic padding and spacing based on iframe dimensions
  const getContainerClasses = () => {
    const width = iframeInfo.dimensions.width;
    const height = iframeInfo.dimensions.height;
    
    let classes = [];
    
    // Padding based on width
    if (width < 350) {
      classes.push('p-1', 'space-y-1');
    } else if (width < 500) {
      classes.push('p-2', 'space-y-2');
    } else if (width < 700) {
      classes.push('p-3', 'space-y-3');
    } else {
      classes.push('p-4', 'space-y-4');
    }
    
    // Additional classes for very small screens
    if (width < 400 || height < 350) {
      classes.push('text-sm');
    }
    
    return classes.join(' ');
  };

  // Get responsive font size
  const getFontSizeClass = () => {
    const width = iframeInfo.dimensions.width;
    
    if (width < 350) {
      return 'text-xs';
    } else if (width < 500) {
      return 'text-sm';
    } else {
      return 'text-base';
    }
  };

  return (
    <div 
      className={`iframe-container ${getContainerHeight()} ${getContainerClasses()} ${getFontSizeClass()} bg-white overflow-hidden`}
      data-iframe={iframeInfo.isInIframe}
      data-width={iframeInfo.dimensions.width}
      data-height={iframeInfo.dimensions.height}
      data-restrictions={JSON.stringify(iframeInfo.restrictions)}
      style={{
        '--iframe-width': `${iframeInfo.dimensions.width}px`,
        '--iframe-height': `${iframeInfo.dimensions.height}px`,
      } as React.CSSProperties}
    >
      {/* Enhanced iframe restrictions warning */}
      {iframeInfo.isInIframe && hasRestrictions && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-2 mb-2">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-4 w-4 text-blue-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-2 flex-1">
              <p className="text-blue-700 font-medium text-xs">
                Compatibility Mode Active
              </p>
              <div className="text-blue-600 text-xs mt-1">
                {!iframeInfo.restrictions.localStorage && (
                  <div>• Using memory storage fallback</div>
                )}
                {!iframeInfo.restrictions.webSocket && (
                  <div>• Using polling for real-time updates</div>
                )}
                {!iframeInfo.restrictions.notifications && (
                  <div>• Notifications sent to parent frame</div>
                )}
                {iframeInfo.restrictions.sandboxRestrictions.length > 0 && (
                  <div>• Sandbox restrictions detected</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offline indicator */}
      {isOffline && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 text-sm mb-2">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-4 w-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-2">
              <p className="text-yellow-700">Working offline - changes will sync when connected</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Main content with iframe-optimized layout */}
      <div className="compact-layout h-full overflow-y-auto">
        {children}
      </div>

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-0 right-0 bg-gray-800 text-white text-xs p-2 rounded-tl opacity-75">
          <div>Iframe: {iframeInfo.isInIframe ? 'Yes' : 'No'}</div>
          <div>Size: {iframeInfo.dimensions.width}x{iframeInfo.dimensions.height}</div>
          <div>Origin: {iframeInfo.parentOrigin || 'None'}</div>
        </div>
      )}
    </div>
  );
};