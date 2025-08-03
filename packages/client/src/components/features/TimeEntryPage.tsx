import React from 'react';
import { TimeEntryList } from './TimeEntryList';

export const TimeEntryPage: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Time Entries</h2>
      </div>
      
      <TimeEntryList />
    </div>
  );
};