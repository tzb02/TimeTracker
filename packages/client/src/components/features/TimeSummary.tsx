import React from 'react';
import { formatDuration } from '../../utils/time';

interface TimeSummaryProps {
  totalTime: number;
  totalEntries: number;
  averageSessionTime: number;
  mostProductiveDay?: string;
  mostUsedProject?: string;
  className?: string;
}

export const TimeSummary: React.FC<TimeSummaryProps> = ({
  totalTime,
  totalEntries,
  averageSessionTime,
  mostProductiveDay,
  mostUsedProject,
  className = '',
}) => {
  const summaryItems = [
    {
      label: 'Total Time',
      value: formatDuration(totalTime),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Total Entries',
      value: totalEntries.toString(),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Average Session',
      value: formatDuration(averageSessionTime),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'text-purple-600 bg-purple-50',
    },
  ];

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <h3 className="text-sm font-medium text-gray-900 mb-4">Summary</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {summaryItems.map((item, index) => (
          <div key={index} className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${item.color}`}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 truncate">{item.label}</p>
              <p className="text-sm font-semibold text-gray-900 truncate" title={item.value}>
                {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {(mostProductiveDay || mostUsedProject) && (
        <div className="border-t border-gray-200 pt-4 space-y-2">
          {mostProductiveDay && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Most Productive Day:</span>
              <span className="font-medium text-gray-900">{mostProductiveDay}</span>
            </div>
          )}
          {mostUsedProject && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Most Used Project:</span>
              <span className="font-medium text-gray-900 truncate ml-2" title={mostUsedProject}>
                {mostUsedProject}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};