import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ReportFilters, reportApi, TimeReportData } from '../../lib/api';
import { ReportFilters as ReportFiltersComponent } from './ReportFilters';
import { TimeSummary } from './TimeSummary';
import { ExportButtons } from './ExportButtons';
import { BarChart, PieChart } from '../ui/Chart';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Alert } from '../ui/Alert';
import { formatDuration } from '../../utils/time';

export const ReportingDashboard: React.FC = () => {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>({});

  const { data: reportData, isLoading, error, refetch } = useQuery({
    queryKey: ['timeReport', appliedFilters],
    queryFn: () => reportApi.getTimeReport(appliedFilters),
    enabled: true,
  });

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
  };

  const handleClearFilters = () => {
    const emptyFilters: ReportFilters = {};
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!reportData) return { projectChart: [], dailyChart: [] };

    const projectChart = reportData.breakdown.byProject.map(project => ({
      label: project.projectName,
      value: project.totalTime,
      color: project.projectColor,
    }));

    const dailyChart = reportData.breakdown.byDay.slice(-7).map(day => ({
      label: new Date(day.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      }),
      value: day.totalTime,
      color: '#3B82F6',
    }));

    return { projectChart, dailyChart };
  }, [reportData]);

  if (error) {
    return (
      <div className="p-4">
        <Alert
          type="error"
          title="Error loading report"
          message="Failed to load reporting data. Please try again."
          action={{
            label: 'Retry',
            onClick: () => refetch(),
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Analyze your time tracking data and export reports
          </p>
        </div>
        <ExportButtons filters={appliedFilters} />
      </div>

      {/* Filters */}
      <ReportFiltersComponent
        filters={filters}
        onFiltersChange={setFilters}
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Report Content */}
      {reportData && (
        <>
          {/* Summary */}
          <TimeSummary
            totalTime={reportData.summary.totalTime}
            totalEntries={reportData.summary.totalEntries}
            averageSessionTime={reportData.summary.averageSessionTime}
            mostProductiveDay={reportData.summary.mostProductiveDay}
            mostUsedProject={reportData.summary.mostUsedProject}
          />

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Project Breakdown */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Time by Project</h3>
              {chartData.projectChart.length > 0 ? (
                <PieChart
                  data={chartData.projectChart}
                  size={180}
                  formatValue={formatDuration}
                  className="justify-center"
                />
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
                  No project data available
                </div>
              )}
            </div>

            {/* Daily Breakdown */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Daily Activity (Last 7 Days)</h3>
              {chartData.dailyChart.length > 0 ? (
                <BarChart
                  data={chartData.dailyChart}
                  height={180}
                  formatValue={formatDuration}
                />
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
                  No daily data available
                </div>
              )}
            </div>
          </div>

          {/* Detailed Breakdown Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Project Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Project Details</h3>
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Project
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Entries
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        %
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.breakdown.byProject.map((project, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: project.projectColor }}
                            />
                            <span className="text-sm text-gray-900 truncate" title={project.projectName}>
                              {project.projectName}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900">
                          {formatDuration(project.totalTime)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900">
                          {project.entryCount}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900">
                          {project.percentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Daily Breakdown</h3>
              <div className="overflow-hidden max-h-64 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Entries
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.breakdown.byDay.slice().reverse().map((day, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {new Date(day.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900">
                          {formatDuration(day.totalTime)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right text-sm text-gray-900">
                          {day.entryCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Trends */}
          {reportData.trends && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Trends</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Daily Average</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatDuration(reportData.trends.dailyAverage)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Weekly Trend</p>
                  <div className="flex items-center justify-center space-x-1">
                    {reportData.trends.weeklyTrend === 'up' && (
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
                      </svg>
                    )}
                    {reportData.trends.weeklyTrend === 'down' && (
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-9.2 9.2M7 7v10h10" />
                      </svg>
                    )}
                    {reportData.trends.weeklyTrend === 'stable' && (
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    )}
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {reportData.trends.weeklyTrend}
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Productivity Score</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {reportData.trends.productivityScore.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {reportData && reportData.summary.totalEntries === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No data found</h3>
          <p className="text-gray-500 mb-4">
            No time entries found for the selected filters. Try adjusting your date range or clearing filters.
          </p>
        </div>
      )}
    </div>
  );
};