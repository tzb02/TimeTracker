import React, { useState } from 'react';
import { TimeEntryFilters as Filters, Project } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface TimeEntryFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  projects: Project[];
}

export const TimeEntryFilters: React.FC<TimeEntryFiltersProps> = ({
  filters,
  onFiltersChange,
  projects,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localFilters, setLocalFilters] = useState<Filters>(filters);

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
  };

  const handleClearFilters = () => {
    const emptyFilters: Filters = {};
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
  };

  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = filters[key as keyof Filters];
    return value !== undefined && value !== '' && (Array.isArray(value) ? value.length > 0 : true);
  });

  const formatDateForInput = (date?: Date) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setLocalFilters({
      ...localFilters,
      [field]: value ? new Date(value) : undefined,
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Filter Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Filters</span>
          {hasActiveFilters && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
            >
              Clear
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? '▲' : '▼'}
          </Button>
        </div>
      </div>

      {/* Quick Search */}
      <div className="p-3">
        <Input
          placeholder="Search entries..."
          value={localFilters.search || ''}
          onChange={(e) => setLocalFilters({ ...localFilters, search: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleApplyFilters();
            }
          }}
          className="w-full"
        />
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="p-3 border-t border-gray-200 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Project Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project
              </label>
              <select
                value={localFilters.projectId || ''}
                onChange={(e) => setLocalFilters({
                  ...localFilters,
                  projectId: e.target.value || undefined,
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={formatDateForInput(localFilters.startDate)}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
                className="w-full"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <Input
                type="date"
                value={formatDateForInput(localFilters.endDate)}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
                className="w-full"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={localFilters.isRunning === undefined ? '' : localFilters.isRunning.toString()}
                onChange={(e) => setLocalFilters({
                  ...localFilters,
                  isRunning: e.target.value === '' ? undefined : e.target.value === 'true',
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Entries</option>
                <option value="true">Running</option>
                <option value="false">Completed</option>
              </select>
            </div>
          </div>

          {/* Apply Filters Button */}
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleApplyFilters}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};