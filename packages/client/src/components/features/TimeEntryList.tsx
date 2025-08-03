import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeEntryApi, projectApi, TimeEntryWithProject, TimeEntryFilters, BulkUpdateRequest } from '../../lib/api';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Dropdown } from '../ui/Dropdown';
import { Pagination } from '../ui/Pagination';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { TimeEntryResponsiveLayout } from './TimeEntryResponsiveLayout';
import { TimeEntryFilters as FilterComponent } from './TimeEntryFilters';
import { formatDuration } from '../../utils/time';

const ITEMS_PER_PAGE = 20;

export const TimeEntryList: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<TimeEntryFilters>({});
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkUpdateDialog, setShowBulkUpdateDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [bulkUpdateData, setBulkUpdateData] = useState({
    projectId: '',
    description: '',
    tags: '',
  });
  const [bulkError, setBulkError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Fetch time entries
  const {
    data: entriesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['timeEntries', currentPage, filters],
    queryFn: () => timeEntryApi.getAll(filters, ITEMS_PER_PAGE, (currentPage - 1) * ITEMS_PER_PAGE),
  });

  // Fetch projects for filtering
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.getAll(),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: timeEntryApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      setShowDeleteDialog(false);
      setEntryToDelete(null);
      setBulkError(null);
    },
    onError: (error: any) => {
      setBulkError(error?.response?.data?.error?.message || 'Failed to delete entry');
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: timeEntryApi.bulkDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      setSelectedEntries(new Set());
      setShowBulkDeleteDialog(false);
      setBulkError(null);
    },
    onError: (error: any) => {
      setBulkError(error?.response?.data?.error?.message || 'Failed to delete entries');
    },
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: timeEntryApi.bulkUpdate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      setSelectedEntries(new Set());
      setShowBulkUpdateDialog(false);
      setBulkUpdateData({ projectId: '', description: '', tags: '' });
      setBulkError(null);
    },
    onError: (error: any) => {
      setBulkError(error?.response?.data?.error?.message || 'Failed to update entries');
    },
  });

  const entries = entriesData?.entries || [];
  const totalEntries = entriesData?.total || 0;
  const totalPages = Math.ceil(totalEntries / ITEMS_PER_PAGE);
  const projects = projectsData?.projects || [];

  // Memoized calculations for performance
  const selectedEntriesData = useMemo(() => {
    const selectedEntryList = entries.filter(entry => selectedEntries.has(entry.id));
    const totalDuration = selectedEntryList.reduce((sum, entry) => sum + entry.duration, 0);
    return { entries: selectedEntryList, totalDuration };
  }, [entries, selectedEntries]);

  const isAllSelected = entries.length > 0 && selectedEntries.size === entries.length;
  const isPartiallySelected = selectedEntries.size > 0 && selectedEntries.size < entries.length;

  // Handle selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEntries(new Set(entries.map(entry => entry.id)));
    } else {
      setSelectedEntries(new Set());
    }
  };

  const handleSelectEntry = (entryId: string, checked: boolean) => {
    const newSelected = new Set(selectedEntries);
    if (checked) {
      newSelected.add(entryId);
    } else {
      newSelected.delete(entryId);
    }
    setSelectedEntries(newSelected);
  };

  // Handle bulk actions
  const handleBulkAction = (action: string) => {
    switch (action) {
      case 'delete':
        setShowBulkDeleteDialog(true);
        break;
      case 'update':
        setShowBulkUpdateDialog(true);
        break;
      // Add more bulk actions here as needed
    }
  };

  // Handle delete
  const handleDeleteClick = (entryId: string) => {
    setEntryToDelete(entryId);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (entryToDelete) {
      deleteMutation.mutate(entryToDelete);
    }
  };

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate({ entryIds: Array.from(selectedEntries) });
  };

  const handleBulkUpdate = () => {
    const updates: BulkUpdateRequest['updates'] = {};
    
    if (bulkUpdateData.projectId) {
      updates.projectId = bulkUpdateData.projectId;
    }
    
    if (bulkUpdateData.description.trim()) {
      updates.description = bulkUpdateData.description.trim();
    }
    
    if (bulkUpdateData.tags.trim()) {
      updates.tags = bulkUpdateData.tags.split(',').map(tag => tag.trim()).filter(Boolean);
    }

    // Only proceed if there are updates to apply
    if (Object.keys(updates).length > 0) {
      bulkUpdateMutation.mutate({
        entryIds: Array.from(selectedEntries),
        updates,
      });
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when no input is focused
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'a':
            event.preventDefault();
            handleSelectAll(!isAllSelected);
            break;
          case 'd':
            if (selectedEntries.size > 0) {
              event.preventDefault();
              setShowBulkDeleteDialog(true);
            }
            break;
          case 'u':
            if (selectedEntries.size > 0) {
              event.preventDefault();
              setShowBulkUpdateDialog(true);
            }
            break;
        }
      }

      // Escape key to clear selection
      if (event.key === 'Escape') {
        setSelectedEntries(new Set());
        setEditingEntry(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedEntries.size, isAllSelected]);



  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">Failed to load time entries</p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error Display */}
      {bulkError && (
        <Alert variant="error" onClose={() => setBulkError(null)}>
          {bulkError}
        </Alert>
      )}

      {/* Filters */}
      <FilterComponent
        filters={filters}
        onFiltersChange={setFilters}
        projects={projects}
      />

      {/* Bulk Actions */}
      {selectedEntries.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-blue-700">
              {selectedEntries.size} {selectedEntries.size === 1 ? 'entry' : 'entries'} selected
            </span>
            <span className="text-sm text-blue-600">
              Total: {formatDuration(selectedEntriesData.totalDuration)}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Dropdown
              trigger={
                <Button variant="outline" size="sm">
                  Actions ▼
                </Button>
              }
              options={[
                { value: 'update', label: 'Update Selected (Ctrl+U)', icon: '✏️' },
                { value: 'delete', label: 'Delete Selected (Ctrl+D)', icon: '🗑️' },
              ]}
              onSelect={handleBulkAction}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedEntries(new Set())}
              title="Clear selection (Esc)"
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      {entries.length > 0 && (
        <div className="text-xs text-gray-500 px-2">
          <span>Shortcuts: </span>
          <span className="font-mono">Ctrl+A</span> select all, 
          <span className="font-mono"> Ctrl+U</span> update selected, 
          <span className="font-mono"> Ctrl+D</span> delete selected, 
          <span className="font-mono"> Esc</span> clear selection
        </div>
      )}

      {/* Entry List */}
      {entries.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No time entries found</p>
          {Object.keys(filters).length > 0 && (
            <Button
              variant="ghost"
              onClick={() => setFilters({})}
              className="mt-2"
            >
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <TimeEntryResponsiveLayout
          entries={entries}
          selectedEntries={selectedEntries}
          onSelectEntry={handleSelectEntry}
          onSelectAll={handleSelectAll}
          editingEntry={editingEntry}
          onEdit={(entryId) => setEditingEntry(entryId)}
          onDelete={handleDeleteClick}
          onEditComplete={() => setEditingEntry(null)}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalEntries}
          itemsPerPage={ITEMS_PER_PAGE}
          className="mt-6"
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setEntryToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Time Entry"
        message="Are you sure you want to delete this time entry? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showBulkDeleteDialog}
        onClose={() => setShowBulkDeleteDialog(false)}
        onConfirm={handleBulkDelete}
        title="Delete Time Entries"
        message={`Are you sure you want to delete ${selectedEntries.size} time ${selectedEntries.size === 1 ? 'entry' : 'entries'}? This action cannot be undone.`}
        confirmText="Delete All"
        variant="danger"
        isLoading={bulkDeleteMutation.isPending}
      />

      {/* Bulk Update Dialog */}
      <Modal
        isOpen={showBulkUpdateDialog}
        onClose={() => {
          setShowBulkUpdateDialog(false);
          setBulkUpdateData({ projectId: '', description: '', tags: '' });
          setBulkError(null);
        }}
        title={`Update ${selectedEntries.size} Time ${selectedEntries.size === 1 ? 'Entry' : 'Entries'}`}
      >
        <div className="space-y-4">
          {bulkError && (
            <Alert variant="error" onClose={() => setBulkError(null)}>
              {bulkError}
            </Alert>
          )}
          
          <p className="text-sm text-gray-600">
            Update the selected time entries. Leave fields empty to keep existing values.
          </p>
          
          {/* Project Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project
            </label>
            <select
              value={bulkUpdateData.projectId}
              onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, projectId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Keep existing project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <Input
              label="Description"
              value={bulkUpdateData.description}
              onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, description: e.target.value })}
              placeholder="Keep existing description"
            />
          </div>

          {/* Tags */}
          <div>
            <Input
              label="Tags"
              value={bulkUpdateData.tags}
              onChange={(e) => setBulkUpdateData({ ...bulkUpdateData, tags: e.target.value })}
              placeholder="tag1, tag2, tag3"
              helperText="Comma-separated tags (will replace existing tags)"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="ghost"
              onClick={() => {
                setShowBulkUpdateDialog(false);
                setBulkUpdateData({ projectId: '', description: '', tags: '' });
                setBulkError(null);
              }}
              disabled={bulkUpdateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleBulkUpdate}
              loading={bulkUpdateMutation.isPending}
              disabled={!bulkUpdateData.projectId && !bulkUpdateData.description.trim() && !bulkUpdateData.tags.trim()}
            >
              Update Entries
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};