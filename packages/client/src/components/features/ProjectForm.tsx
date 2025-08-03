import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Project, projectApi, CreateProjectRequest, UpdateProjectRequest, isApiError } from '../../lib/api';
import { Button } from '../ui/Button';
import { ColorPicker } from '../ui/ColorPicker';
import { Alert } from '../ui/Alert';

interface ProjectFormProps {
  project?: Project;
  usedColors?: string[];
  onSuccess: (project: Project) => void;
  onCancel: () => void;
}

export const ProjectForm: React.FC<ProjectFormProps> = ({
  project,
  usedColors = [],
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    name: project?.name || '',
    color: project?.color || '#3B82F6',
    description: project?.description || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: CreateProjectRequest) => projectApi.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onSuccess(response.project);
    },
    onError: (error) => {
      if (isApiError(error)) {
        const apiError = error.response?.data.error;
        if (apiError?.code === 'PROJECT_NAME_EXISTS') {
          setErrors({ name: 'A project with this name already exists' });
        } else if (apiError?.code === 'INVALID_COLOR') {
          setErrors({ color: 'Please enter a valid hex color code' });
        } else {
          setErrors({ general: apiError?.message || 'Failed to create project' });
        }
      } else {
        setErrors({ general: 'Failed to create project' });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: UpdateProjectRequest }) =>
      projectApi.update(data.id, data.updates),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onSuccess(response.project);
    },
    onError: (error) => {
      if (isApiError(error)) {
        const apiError = error.response?.data.error;
        if (apiError?.code === 'PROJECT_NAME_EXISTS') {
          setErrors({ name: 'A project with this name already exists' });
        } else if (apiError?.code === 'INVALID_COLOR') {
          setErrors({ color: 'Please enter a valid hex color code' });
        } else {
          setErrors({ general: apiError?.message || 'Failed to update project' });
        }
      } else {
        setErrors({ general: 'Failed to update project' });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate form
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(formData.color)) {
      newErrors.color = 'Please enter a valid hex color code';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const data = {
      name: formData.name.trim(),
      color: formData.color,
      description: formData.description.trim() || undefined,
    };

    if (project) {
      updateMutation.mutate({ id: project.id, updates: data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.general && (
        <Alert variant="error">{errors.general}</Alert>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Project Name *
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className={`block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
            errors.name ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="Enter project name"
          maxLength={255}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Color *
        </label>
        <ColorPicker
          value={formData.color}
          onChange={(color) => setFormData({ ...formData, color })}
          usedColors={usedColors.filter(c => c !== project?.color)}
        />
        {errors.color && (
          <p className="mt-1 text-sm text-red-600">{errors.color}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Optional project description"
          maxLength={1000}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : project ? 'Update Project' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
};