import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { timeEntryApi, TimeEntryWithProject, UpdateTimeEntryRequest } from '../../lib/api';
import { Checkbox } from '../ui/Checkbox';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { formatDuration, formatTime, parseDuration } from '../../utils/time';

interface TimeEntryItemProps {
  entry: TimeEntryWithProject;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
  onEditComplete: () => void;
}

export const TimeEntryItem: React.FC<TimeEntryItemProps> = ({
  entry,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  isEditing,
  onEditComplete,
}) => {
  const [editData, setEditData] = useState({
    description: entry.description,
    duration: formatDuration(entry.duration),
    startTime: new Date(entry.startTime).toTimeString().slice(0, 5), // HH:MM format
    endTime: entry.endTime ? new Date(entry.endTime).toTimeString().slice(0, 5) : '',
  });

  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTimeEntryRequest }) =>
      timeEntryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      onEditComplete();
    },
  });

  const handleSave = () => {
    const updates: UpdateTimeEntryRequest = {
      description: editData.description,
      duration: parseDuration(editData.duration),
    };

    // If times are provided, calculate duration from them
    if (editData.startTime && editData.endTime) {
      const startDate = new Date(entry.startTime);
      const endDate = new Date(entry.startTime); // Same date
      
      const [startHour, startMin] = editData.startTime.split(':').map(Number);
      const [endHour, endMin] = editData.endTime.split(':').map(Number);
      
      startDate.setHours(startHour, startMin, 0, 0);
      endDate.setHours(endHour, endMin, 0, 0);
      
      // Handle next day scenario
      if (endDate < startDate) {
        endDate.setDate(endDate.getDate() + 1);
      }
      
      updates.startTime = startDate;
      updates.endTime = endDate;
      updates.duration = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);
    }

    updateMutation.mutate({ id: entry.id, data: updates });
  };

  const handleCancel = () => {
    setEditData({
      description: entry.description,
      duration: formatDuration(entry.duration),
      startTime: new Date(entry.startTime).toTimeString().slice(0, 5),
      endTime: entry.endTime ? new Date(entry.endTime).toTimeString().slice(0, 5) : '',
    });
    onEditComplete();
  };

  if (isEditing) {
    return (
      <div className="p-3 bg-white border border-blue-200 rounded-lg shadow-sm">
        <div className="flex items-start space-x-3">
          <Checkbox
            checked={isSelected}
            onChange={onSelect}
            className="mt-1"
          />
          
          <div className="flex-1 space-y-3">
            {/* Description */}
            <Input
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              placeholder="Task description..."
              className="w-full"
            />
            
            {/* Time inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                <Input
                  type="time"
                  value={editData.startTime}
                  onChange={(e) => setEditData({ ...editData, startTime: e.target.value })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">End Time</label>
                <Input
                  type="time"
                  value={editData.endTime}
                  onChange={(e) => setEditData({ ...editData, endTime: e.target.value })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Duration</label>
                <Input
                  value={editData.duration}
                  onChange={(e) => setEditData({ ...editData, duration: e.target.value })}
                  placeholder="0:00"
                  className="w-full"
                />
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex justify-end space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                loading={updateMutation.isPending}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
      <div className="flex items-center space-x-3">
        <Checkbox
          checked={isSelected}
          onChange={onSelect}
        />
        
        {/* Project Color */}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: entry.project.color }}
        />
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-sm font-medium text-gray-900 truncate">
                  {entry.project.name}
                </span>
                {entry.isRunning && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    Running
                  </span>
                )}
              </div>
              
              {entry.description && (
                <p className="text-sm text-gray-600 truncate mb-1">
                  {entry.description}
                </p>
              )}
              
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <span>{formatTime(entry.startTime)}</span>
                {entry.endTime && (
                  <>
                    <span>→</span>
                    <span>{formatTime(entry.endTime)}</span>
                  </>
                )}
                <span className="font-medium">
                  {formatDuration(entry.duration)}
                </span>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-1 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="p-1 h-auto"
                title="Edit entry"
              >
                ✏️
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="p-1 h-auto text-red-600 hover:text-red-700"
                title="Delete entry"
              >
                🗑️
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};