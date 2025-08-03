import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../store/useAppStore';
import { Project, projectApi, CreateProjectRequest, isApiError } from '../../lib/api';
import { Button } from '../ui/Button';
import { ColorPicker } from '../ui/ColorPicker';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Alert } from '../ui/Alert';

interface ProjectSelectorProps {
  className?: string;
  onManageProjects?: () => void;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({ 
  className = '',
  onManageProjects 
}) => {
  const { timer } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    color: '#3B82F6',
    description: '',
  });
  const [createError, setCreateError] = useState('');
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch projects with search
  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects', { search: searchTerm }],
    queryFn: () => projectApi.getAll({ search: searchTerm }),
    staleTime: 30000, // 30 seconds
  });

  // Fetch used colors for color picker
  const { data: usedColorsData } = useQuery({
    queryKey: ['projects', 'colors'],
    queryFn: () => projectApi.getUsedColors(),
    staleTime: 60000, // 1 minute
  });

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateProjectRequest) => projectApi.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      handleProjectSelect(response.project.id);
      setShowCreateForm(false);
      setCreateFormData({ name: '', color: '#3B82F6', description: '' });
      setCreateError('');
    },
    onError: (error) => {
      if (isApiError(error)) {
        const apiError = error.response?.data.error;
        if (apiError?.code === 'PROJECT_NAME_EXISTS') {
          setCreateError('A project with this name already exists');
        } else {
          setCreateError(apiError?.message || 'Failed to create project');
        }
      } else {
        setCreateError('Failed to create project');
      }
    },
  });

  const projects = projectsData?.projects || [];
  const usedColors = usedColorsData?.colors || [];
  const selectedProject = projects.find(p => p.id === timer.projectId);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCreateForm(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleProjectSelect = (projectId: string) => {
    // Update the timer state with the new project
    if (!timer.isRunning) {
      useAppStore.setState(state => ({
        timer: {
          ...state.timer,
          projectId,
        }
      }));
    }
    setIsOpen(false);
    setSearchTerm('');
    setShowCreateForm(false);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!createFormData.name.trim()) {
      setCreateError('Project name is required');
      return;
    }

    createMutation.mutate({
      name: createFormData.name.trim(),
      color: createFormData.color,
      description: createFormData.description.trim() || undefined,
    });
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const showCreateOption = searchTerm && !filteredProjects.some(p => 
    p.name.toLowerCase() === searchTerm.toLowerCase()
  );

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Project
      </label>
      
      {/* Selected Project Display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={timer.isRunning}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedProject ? (
            <>
              <div
                className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0"
                style={{ backgroundColor: selectedProject.color }}
              />
              <span className="truncate">{selectedProject.name}</span>
            </>
          ) : (
            <span className="text-gray-500">Select a project...</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search projects..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Projects List */}
          <div className="max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <LoadingSpinner size="sm" />
              </div>
            ) : filteredProjects.length === 0 && !showCreateOption ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                {searchTerm ? 'No projects found' : 'No projects available'}
              </div>
            ) : (
              <>
                {filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleProjectSelect(project.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 focus:outline-none focus:bg-gray-50 ${
                      selectedProject?.id === project.id ? 'bg-primary-50 text-primary-700' : 'text-gray-900'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="truncate font-medium">{project.name}</div>
                      {project.description && (
                        <div className="truncate text-xs text-gray-500 mt-0.5">
                          {project.description}
                        </div>
                      )}
                    </div>
                    {selectedProject?.id === project.id && (
                      <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}

                {/* Create New Project Option */}
                {showCreateOption && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(true);
                      setCreateFormData(prev => ({ ...prev, name: searchTerm }));
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 focus:outline-none focus:bg-primary-50 border-t border-gray-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Create "{searchTerm}"</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Quick Actions */}
          <div className="border-t border-gray-200 p-2 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowCreateForm(true)}
              className="flex-1"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </Button>
            {onManageProjects && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsOpen(false);
                  onManageProjects();
                }}
                className="flex-1"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Manage
              </Button>
            )}
          </div>

          {/* Inline Create Form */}
          {showCreateForm && (
            <div className="border-t border-gray-200 p-3 bg-gray-50">
              <form onSubmit={handleCreateProject} className="space-y-3">
                {createError && (
                  <Alert variant="error">{createError}</Alert>
                )}
                
                <div>
                  <input
                    type="text"
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Project name"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    maxLength={255}
                  />
                </div>

                <div>
                  <ColorPicker
                    value={createFormData.color}
                    onChange={(color) => setCreateFormData(prev => ({ ...prev, color }))}
                    usedColors={usedColors}
                    className="w-full"
                  />
                </div>

                <div>
                  <textarea
                    value={createFormData.description}
                    onChange={(e) => setCreateFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    maxLength={1000}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={createMutation.isPending || !createFormData.name.trim()}
                    className="flex-1"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setShowCreateForm(false);
                      setCreateFormData({ name: '', color: '#3B82F6', description: '' });
                      setCreateError('');
                    }}
                    disabled={createMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};