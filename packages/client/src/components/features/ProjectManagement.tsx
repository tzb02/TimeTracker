import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Project, projectApi, isApiError } from '../../lib/api';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ProjectForm } from './ProjectForm';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Alert } from '../ui/Alert';

interface ProjectManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectManagement: React.FC<ProjectManagementProps> = ({
  isOpen,
  onClose,
}) => {
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string>('');

  const queryClient = useQueryClient();

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects', { includeInactive: true, withStats: true }],
    queryFn: () => projectApi.getAll({ includeInactive: true, withStats: true }),
    enabled: isOpen,
  });

  const { data: usedColorsData } = useQuery({
    queryKey: ['projects', 'colors'],
    queryFn: () => projectApi.getUsedColors(),
    enabled: isOpen,
  });

  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => projectApi.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDeletingProject(null);
      setError('');
    },
    onError: (error) => {
      if (isApiError(error)) {
        setError(error.response?.data.error.message || 'Failed to delete project');
      } else {
        setError('Failed to delete project');
      }
    },
  });

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setShowCreateForm(false);
  };

  const handleDelete = (project: Project) => {
    setDeletingProject(project);
    setError('');
  };

  const confirmDelete = () => {
    if (deletingProject) {
      deleteMutation.mutate(deletingProject.id);
    }
  };

  const handleFormSuccess = () => {
    setEditingProject(null);
    setShowCreateForm(false);
    setError('');
  };

  const handleFormCancel = () => {
    setEditingProject(null);
    setShowCreateForm(false);
  };

  const projects = projectsData?.projects || [];
  const usedColors = usedColorsData?.colors || [];

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Manage Projects"
        size="lg"
      >
        <div className="space-y-4">
          {error && (
            <Alert variant="error">{error}</Alert>
          )}

          {/* Create Project Button */}
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-medium text-gray-700">Your Projects</h4>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateForm(true)}
            >
              Create Project
            </Button>
          </div>

          {/* Projects List */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="md" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No projects found.</p>
              <p className="text-sm">Create your first project to get started.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {projects.map((project) => {
                const projectWithStats = project as Project & { totalTime?: number; entryCount?: number };
                return (
                  <div
                    key={project.id}
                    className={`flex items-center justify-between p-3 border rounded-lg ${
                      project.isActive ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: project.color }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h5 className={`font-medium ${project.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                            {project.name}
                          </h5>
                          {!project.isActive && (
                            <span className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        {project.description && (
                          <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                        )}
                        {projectWithStats.totalTime !== undefined && (
                          <p className="text-xs text-gray-500 mt-1">
                            {Math.floor(projectWithStats.totalTime / 3600)}h {Math.floor((projectWithStats.totalTime % 3600) / 60)}m tracked
                            {(projectWithStats.entryCount || 0) > 0 && ` • ${projectWithStats.entryCount} entries`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleEdit(project)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(project)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Create Project Modal */}
      <Modal
        isOpen={showCreateForm}
        onClose={handleFormCancel}
        title="Create New Project"
      >
        <ProjectForm
          usedColors={usedColors}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={!!editingProject}
        onClose={handleFormCancel}
        title="Edit Project"
      >
        {editingProject && (
          <ProjectForm
            project={editingProject}
            usedColors={usedColors}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingProject}
        onClose={() => setDeletingProject(null)}
        title="Delete Project"
      >
        {deletingProject && (
          <div className="space-y-4">
            <p className="text-gray-700">
              Are you sure you want to delete the project "{deletingProject.name}"?
            </p>
            <p className="text-sm text-gray-600">
              This action cannot be undone. If the project has time entries, it will be marked as inactive instead of being permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setDeletingProject(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Project'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};