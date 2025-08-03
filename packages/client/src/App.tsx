import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/features/auth';
import { UserSwitcher } from './components/features/auth';
import { IframeLayout } from './components/layouts/IframeLayout';
import { NavigationTabs } from './components/layouts/NavigationTabs';
import { Suspense } from 'react';
import { LazyTimerPage, LazyTimeEntryPage, LazyReportsPage } from './components/LazyComponents';
import { useAppStore } from './store/useAppStore';
import { useIframeIntegration } from './hooks/useIframeIntegration';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  const { activeView } = useAppStore();
  
  // Initialize iframe integration
  useIframeIntegration();

  const renderContent = () => {
    const LoadingSpinner = () => (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );

    switch (activeView) {
      case 'timer':
        return (
          <div className="p-4">
            <Suspense fallback={<LoadingSpinner />}>
              <LazyTimerPage />
            </Suspense>
          </div>
        );
      case 'entries':
        return (
          <div className="p-4">
            <Suspense fallback={<LoadingSpinner />}>
              <LazyTimeEntryPage />
            </Suspense>
          </div>
        );
      case 'reports':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <LazyReportsPage />
          </Suspense>
        );
      default:
        return (
          <div className="p-4">
            <Suspense fallback={<LoadingSpinner />}>
              <LazyTimerPage />
            </Suspense>
          </div>
        );
    }
  };

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ProtectedRoute>
          <IframeLayout>
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h1 className="text-lg font-bold text-gray-900">
                  Time Tracker
                </h1>
                <UserSwitcher />
              </div>
              
              {/* Navigation */}
              <NavigationTabs />
              
              {/* Main Content */}
              <div className="flex-1 overflow-auto">
                {renderContent()}
              </div>
            </div>
          </IframeLayout>
        </ProtectedRoute>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;