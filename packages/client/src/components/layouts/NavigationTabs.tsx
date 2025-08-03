import React from 'react';
import { useAppStore } from '../../store/useAppStore';

const tabs = [
  { id: 'timer' as const, label: 'Timer', icon: '⏱️' },
  { id: 'entries' as const, label: 'Entries', icon: '📋' },
  { id: 'reports' as const, label: 'Reports', icon: '📊' },
];

export const NavigationTabs: React.FC = () => {
  const { activeView, setActiveView } = useAppStore();

  return (
    <div className="border-b border-gray-200 bg-white">
      <nav className="flex space-x-1 px-2" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`
              flex items-center px-3 py-2 text-sm font-medium rounded-t-md transition-colors
              ${activeView === tab.id
                ? 'bg-primary-50 text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }
            `}
            aria-current={activeView === tab.id ? 'page' : undefined}
          >
            <span className="mr-1 text-base">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};