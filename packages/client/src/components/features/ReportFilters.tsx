import React from 'react';
import { DateRangePicker } from '../ui/DateRangePicker';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { ReportFilters as ReportFiltersType } from '../../lib/api';
import { useQuery } from '@tanstack/react-query';
import { projectApi } from '../../lib/api';

interface ReportFiltersProps {
  filters: ReportFiltersType;
  onFiltersChange: (filters: ReportFiltersType) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  className?: string;
}

export const ReportFilters: React.FC<ReportFiltersProps> = ({
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters,
  className = '',
}) => {
  const { data: projectsData } = useQuery({
    queryKey: ['projects', { includeInactive: true }],
    queryFn: () => projectApi.getAll({ includeInactive: true }),
  });

  const projects = projectsData?.projects || [];

  const groupByOptions = [
    { value: 'day', label: 'By Day' },
    { value: 'week', label: 'By Week' },
    { value: 'month', label: 'By Month' },
    { value: 'project', label: 'By Project' },
    { value: 'tag', label: 'By Tag' },
  ];

  const projectOptions = projects.map(project => ({
    value: project.id,
    label: project.name,
    color: project.color,
  }));

  const handleDateRangeChange = (dateRange: { startDate?: Date; endDate?: Date }) => {
    onFiltersChange({
      ...filters,
      dateRange: dateRange.startDate && dateRange.endDate ? {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      } : undefined,
    });
  };

  const handleProjectsChange = (selectedProjects: string[]) => {
    onFiltersChange({
      ...filters,
      projectIds: selectedProjects.length > 0 ? selectedProjects : undefined,
    });
  };

  const handleGroupByChange = (groupBy: string) => {
    onFiltersChange({
      ...filters,
      groupBy: groupBy as ReportFiltersType['groupBy'],
    });
  };

  const hasActiveFilters = !!(
    filters.dateRange ||
    filters.projectIds?.length ||
    filters.tags?.length ||
    filters.groupBy
  );

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Filters</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-gray-500 hover:text-gray-700"
          >
            Clear all
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Date Range */}
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Date Range
          </label>
          <DateRangePicker
            value={{
              startDate: filters.dateRange?.startDate,
              endDate: filters.dateRange?.endDate,
            }}
            onChange={handleDateRangeChange}
          />
        </div>

        {/* Projects */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Projects
          </label>
          <Select
            options={projectOptions}
            value={filters.projectIds || []}
            onChange={handleProjectsChange}
            placeholder="All projects"
            multiple
            className="w-full"
          />
        </div>

        {/* Group By */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Group By
          </label>
          <Select
            options={groupByOptions}
            value={filters.groupBy ? [filters.groupBy] : []}
            onChange={(values: string[]) => handleGroupByChange(values[0] || '')}
            placeholder="No grouping"
            className="w-full"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          disabled={!hasActiveFilters}
        >
          Clear
        </Button>
        <Button
          size="sm"
          onClick={onApplyFilters}
        >
          Apply Filters
        </Button>
      </div>
    </div>
  );
};