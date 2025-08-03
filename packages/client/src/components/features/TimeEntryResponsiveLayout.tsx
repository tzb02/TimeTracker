import React, { useState, useEffect } from 'react';
import { TimeEntryWithProject } from '../../lib/api';
import { TimeEntryItem } from './TimeEntryItem';
import { Checkbox } from '../ui/Checkbox';
import { formatDuration, formatTime, getRelativeDate } from '../../utils/time';

interface TimeEntryResponsiveLayoutProps {
  entries: TimeEntryWithProject[];
  selectedEntries: Set<string>;
  onSelectEntry: (entryId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  editingEntry: string | null;
  onEdit: (entryId: string) => void;
  onDelete: (entryId: string) => void;
  onEditComplete: () => void;
}

type ViewMode = 'card' | 'table';

export const TimeEntryResponsiveLayout: React.FC<TimeEntryResponsiveLayoutProps> = ({
  entries,
  selectedEntries,
  onSelectEntry,
  onSelectAll,
  editingEntry,
  onEdit,
  onDelete,
  onEditComplete,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('card');

  useEffect(() => {
    const updateViewMode = () => {
      const width = window.innerWidth;
      setViewMode(width >= 768 ? 'table' : 'card');
    };

    updateViewMode();
    window.addEventListener('resize', updateViewMode);
    
    return () => window.removeEventListener('resize', updateViewMode);
  }, []);

  const isAllSelected = entries.length > 0 && selectedEntries.size === entries.length;
  const isPartiallySelected = selectedEntries.size > 0 && selectedEntries.size < entries.length;

  // Group entries by date for card view
  const groupedEntries = entries.reduce((groups, entry) => {
    const date = getRelativeDate(entry.startTime);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(entry);
    return groups;
  }, {} as Record<string, TimeEntryWithProject[]>);

  if (viewMode === 'table') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center">
            <Checkbox
              checked={isAllSelected}
              indeterminate={isPartiallySelected}
              onChange={onSelectAll}
              className="mr-4"
            />
            <div className="grid grid-cols-12 gap-4 flex-1 text-sm font-medium text-gray-700">
              <div className="col-span-3">Project</div>
              <div className="col-span-4">Description</div>
              <div className="col-span-2">Time</div>
              <div className="col-span-2">Duration</div>
              <div className="col-span-1">Actions</div>
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-gray-200">
          {entries.map((entry) => (
            <div key={entry.id} className="px-4 py-3 hover:bg-gray-50">
              <div className="flex items-center">
                <Checkbox
                  checked={selectedEntries.has(entry.id)}
                  onChange={(checked) => onSelectEntry(entry.id, checked)}
                  className="mr-4"
                />
                <div className="grid grid-cols-12 gap-4 flex-1 text-sm">
                  {/* Project */}
                  <div className="col-span-3 flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: entry.project.color }}
                    />
                    <span className="font-medium text-gray-900 truncate">
                      {entry.project.name}
                    </span>
                    {entry.isRunning && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Running
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <div className="col-span-4">
                    <span className="text-gray-600 truncate">
                      {entry.description || 'No description'}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="col-span-2 text-gray-500">
                    <div>{formatTime(entry.startTime)}</div>
                    {entry.endTime && (
                      <div className="text-xs">→ {formatTime(entry.endTime)}</div>
                    )}
                  </div>

                  {/* Duration */}
                  <div className="col-span-2 font-medium text-gray-900">
                    {formatDuration(entry.duration)}
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex items-center space-x-1">
                    <button
                      onClick={() => onEdit(entry.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
                      title="Edit entry"
                      aria-label={`Edit time entry for ${entry.project.name}`}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onDelete(entry.id)}
                      className="p-1 text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                      title="Delete entry"
                      aria-label={`Delete time entry for ${entry.project.name}`}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Card view for mobile
  return (
    <div className="space-y-4">
      {/* Select All Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <Checkbox
          checked={isAllSelected}
          indeterminate={isPartiallySelected}
          onChange={onSelectAll}
          label={`Select all ${entries.length} entries`}
        />
        <span className="text-sm text-gray-600">
          Total: {formatDuration(entries.reduce((sum, entry) => sum + entry.duration, 0))}
        </span>
      </div>

      {/* Grouped Entries */}
      {Object.entries(groupedEntries).map(([date, dateEntries]) => (
        <div key={date} className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700 px-2">{date}</h3>
          <div className="space-y-1">
            {dateEntries.map((entry) => (
              <TimeEntryItem
                key={entry.id}
                entry={entry}
                isSelected={selectedEntries.has(entry.id)}
                onSelect={(checked) => onSelectEntry(entry.id, checked)}
                onEdit={() => onEdit(entry.id)}
                onDelete={() => onDelete(entry.id)}
                isEditing={editingEntry === entry.id}
                onEditComplete={onEditComplete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};