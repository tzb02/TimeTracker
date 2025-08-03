import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProjectForm } from '../ProjectForm';
import { projectApi } from '../../../lib/api';

// Mock the API
vi.mock('../../../lib/api', () => ({
    projectApi: {
        create: vi.fn(),
        update: vi.fn(),
    },
    isApiError: vi.fn(),
}));

// Mock the UI components
vi.mock('../../ui/Button', () => ({
    Button: ({ children, onClick, disabled, type, variant }: any) => (
        <button
            onClick={onClick}
            disabled={disabled}
            type={type}
            data-variant={variant}
        >
            {children}
        </button>
    ),
}));

vi.mock('../../ui/ColorPicker', () => ({
    ColorPicker: ({ value, onChange, usedColors }: any) => (
        <div data-testid="color-picker">
            <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                data-testid="color-input"
            />
            <div data-testid="used-colors">{JSON.stringify(usedColors)}</div>
        </div>
    ),
}));

vi.mock('../../ui/Alert', () => ({
    Alert: ({ children, variant }: any) => (
        <div data-testid="alert" data-variant={variant}>
            {children}
        </div>
    ),
}));

const createQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
    },
});

const renderWithQueryClient = (component: React.ReactElement) => {
    const queryClient = createQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            {component}
        </QueryClientProvider>
    );
};

describe('ProjectForm', () => {
    const mockOnSuccess = vi.fn();
    const mockOnCancel = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Create Mode', () => {
        it('renders create form with default values', () => {
            renderWithQueryClient(
                <ProjectForm
                    onSuccess={mockOnSuccess}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByLabelText(/project name/i)).toHaveValue('');
            expect(screen.getByTestId('color-input')).toHaveValue('#3B82F6');
            expect(screen.getByLabelText(/description/i)).toHaveValue('');
            expect(screen.getByRole('button', { name: /create project/i })).toBeInTheDocument();
        });

        it('validates required fields', async () => {
            renderWithQueryClient(
                <ProjectForm
                    onSuccess={mockOnSuccess}
                    onCancel={mockOnCancel}
                />
            );

            const submitButton = screen.getByRole('button', { name: /create project/i });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/project name is required/i)).toBeInTheDocument();
            });
        });

        it('validates color format', async () => {
            renderWithQueryClient(
                <ProjectForm
                    onSuccess={mockOnSuccess}
                    onCancel={mockOnCancel}
                />
            );

            const nameInput = screen.getByLabelText(/project name/i);
            const colorInput = screen.getByTestId('color-input');
            const submitButton = screen.getByRole('button', { name: /create project/i });

            fireEvent.change(nameInput, { target: { value: 'Test Project' } });
            fireEvent.change(colorInput, { target: { value: 'invalid-color' } });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/please enter a valid hex color code/i)).toBeInTheDocument();
            });
        });

        it('creates project successfully', async () => {
            const mockProject = {
                id: '1',
                name: 'Test Project',
                color: '#FF0000',
                description: 'Test description',
                userId: 'user1',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            vi.mocked(projectApi.create).mockResolvedValue({ project: mockProject });

            renderWithQueryClient(
                <ProjectForm
                    onSuccess={mockOnSuccess}
                    onCancel={mockOnCancel}
                />
            );

            const nameInput = screen.getByLabelText(/project name/i);
            const colorInput = screen.getByTestId('color-input');
            const descriptionInput = screen.getByLabelText(/description/i);
            const submitButton = screen.getByRole('button', { name: /create project/i });

            fireEvent.change(nameInput, { target: { value: 'Test Project' } });
            fireEvent.change(colorInput, { target: { value: '#FF0000' } });
            fireEvent.change(descriptionInput, { target: { value: 'Test description' } });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(projectApi.create).toHaveBeenCalledWith({
                    name: 'Test Project',
                    color: '#FF0000',
                    description: 'Test description',
                });
                expect(mockOnSuccess).toHaveBeenCalledWith(mockProject);
            });
        });

        it('handles create error', async () => {
            const mockError = {
                response: {
                    data: {
                        error: {
                            code: 'PROJECT_NAME_EXISTS',
                            message: 'A project with this name already exists',
                        },
                    },
                },
            };

            vi.mocked(projectApi.create).mockRejectedValue(mockError);
            vi.mocked(require('../../../lib/api').isApiError).mockReturnValue(true);

            renderWithQueryClient(
                <ProjectForm
                    onSuccess={mockOnSuccess}
                    onCancel={mockOnCancel}
                />
            );

            const nameInput = screen.getByLabelText(/project name/i);
            const submitButton = screen.getByRole('button', { name: /create project/i });

            fireEvent.change(nameInput, { target: { value: 'Existing Project' } });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/a project with this name already exists/i)).toBeInTheDocument();
            });
        });
    });

    describe('Edit Mode', () => {
        const mockProject = {
            id: '1',
            name: 'Existing Project',
            color: '#00FF00',
            description: 'Existing description',
            userId: 'user1',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        it('renders edit form with project values', () => {
            renderWithQueryClient(
                <ProjectForm
                    project={mockProject}
                    onSuccess={mockOnSuccess}
                    onCancel={mockOnCancel}
                />
            );

            expect(screen.getByLabelText(/project name/i)).toHaveValue('Existing Project');
            expect(screen.getByTestId('color-input')).toHaveValue('#00FF00');
            expect(screen.getByLabelText(/description/i)).toHaveValue('Existing description');
            expect(screen.getByRole('button', { name: /update project/i })).toBeInTheDocument();
        });

        it('updates project successfully', async () => {
            const updatedProject = { ...mockProject, name: 'Updated Project' };
            vi.mocked(projectApi.update).mockResolvedValue({ project: updatedProject });

            renderWithQueryClient(
                <ProjectForm
                    project={mockProject}
                    onSuccess={mockOnSuccess}
                    onCancel={mockOnCancel}
                />
            );

            const nameInput = screen.getByLabelText(/project name/i);
            const submitButton = screen.getByRole('button', { name: /update project/i });

            fireEvent.change(nameInput, { target: { value: 'Updated Project' } });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(projectApi.update).toHaveBeenCalledWith('1', {
                    name: 'Updated Project',
                    color: '#00FF00',
                    description: 'Existing description',
                });
                expect(mockOnSuccess).toHaveBeenCalledWith(updatedProject);
            });
        });

        it('handles update error', async () => {
            const mockError = {
                response: {
                    data: {
                        error: {
                            code: 'INVALID_COLOR',
                            message: 'Please enter a valid hex color code',
                        },
                    },
                },
            };

            vi.mocked(projectApi.update).mockRejectedValue(mockError);
            vi.mocked(require('../../../lib/api').isApiError).mockReturnValue(true);

            renderWithQueryClient(
                <ProjectForm
                    project={mockProject}
                    onSuccess={mockOnSuccess}
                    onCancel={mockOnCancel}
                />
            );

            const colorInput = screen.getByTestId('color-input');
            const submitButton = screen.getByRole('button', { name: /update project/i });

            fireEvent.change(colorInput, { target: { value: 'invalid' } });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/please enter a valid hex color code/i)).toBeInTheDocument();
            });
        });
    });

    describe('Used Colors', () => {
        it('passes used colors to ColorPicker', () => {
            const usedColors = ['#FF0000', '#00FF00', '#0000FF'];

            renderWithQueryClient(
                <ProjectForm
                    usedColors={usedColors}
                    onSuccess={mockOnSuccess}
                    onCancel={mockOnCancel}
                />
            );

            const usedColorsElement = screen.getByTestId('used-colors');
            expect(usedColorsElement).toHaveTextContent(JSON.stringify(usedColors));
        });

        it('filters out current project color from used colors in edit mode', () => {
            const mockProject = {
                id: '1',
                name: 'Test Project',
                color: '#FF0000',
                description: '',
                userId: 'user1',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const usedColors = ['#FF0000', '#00FF00', '#0000FF'];

            renderWithQueryClient(
                <ProjectForm
                    project={mockProject}
                    usedColors={usedColors}
                    onSuccess={mockOnSuccess}
                    onCancel={mockOnCancel}
                />
            );

            const usedColorsElement = screen.getByTestId('used-colors');
            expect(usedColorsElement).toHaveTextContent(JSON.stringify(['#00FF00', '#0000FF']));
        });
    });

    describe('Form Actions', () => {
        it('calls onCancel when cancel button is clicked', () => {
            renderWithQueryClient(
                <ProjectForm
                    onSuccess={mockOnSuccess}
                    onCancel={mockOnCancel}
                />
            );

            const cancelButton = screen.getByRole('button', { name: /cancel/i });
            fireEvent.click(cancelButton);

            expect(mockOnCancel).toHaveBeenCalled();
        });

        it('disables form during submission', async () => {
            vi.mocked(projectApi.create).mockImplementation(() => new Promise(() => { })); // Never resolves

            renderWithQueryClient(
                <ProjectForm
                    onSuccess={mockOnSuccess}
                    onCancel={mockOnCancel}
                />
            );

            const nameInput = screen.getByLabelText(/project name/i);
            const submitButton = screen.getByRole('button', { name: /create project/i });
            const cancelButton = screen.getByRole('button', { name: /cancel/i });

            fireEvent.change(nameInput, { target: { value: 'Test Project' } });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /saving.../i })).toBeDisabled();
                expect(cancelButton).toBeDisabled();
            });
        });
    });

    describe('Form Validation', () => {
        it('trims whitespace from name and description', async () => {
            const mockProject = {
                id: '1',
                name: 'Test Project',
                color: '#FF0000',
                description: 'Test description',
                userId: 'user1',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            vi.mocked(projectApi.create).mockResolvedValue({ project: mockProject });

            renderWithQueryClient(
                <ProjectForm
                    onSuccess={mockOnSuccess}
                    onCancel={mockOnCancel}
                />
            );

            const nameInput = screen.getByLabelText(/project name/i);
            const descriptionInput = screen.getByLabelText(/description/i);
            const submitButton = screen.getByRole('button', { name: /create project/i });

            fireEvent.change(nameInput, { target: { value: '  Test Project  ' } });
            fireEvent.change(descriptionInput, { target: { value: '  Test description  ' } });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(projectApi.create).toHaveBeenCalledWith({
                    name: 'Test Project',
                    color: '#3B82F6',
                    description: 'Test description',
                });
            });
        });

        it('omits empty description', async () => {
            const mockProject = {
                id: '1',
                name: 'Test Project',
                color: '#FF0000',
                userId: 'user1',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            vi.mocked(projectApi.create).mockResolvedValue({ project: mockProject });

            renderWithQueryClient(
                <ProjectForm
                    onSuccess={mockOnSuccess}
                    onCancel={mockOnCancel}
                />
            );

            const nameInput = screen.getByLabelText(/project name/i);
            const submitButton = screen.getByRole('button', { name: /create project/i });

            fireEvent.change(nameInput, { target: { value: 'Test Project' } });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(projectApi.create).toHaveBeenCalledWith({
                    name: 'Test Project',
                    color: '#3B82F6',
                    description: undefined,
                });
            });
        });

        it('enforces maximum length limits', () => {
            renderWithQueryClient(
                <ProjectForm
                    onSuccess={mockOnSuccess}
                    onCancel={mockOnCancel}
                />
            );

            const nameInput = screen.getByLabelText(/project name/i);
            const descriptionInput = screen.getByLabelText(/description/i);

            expect(nameInput).toHaveAttribute('maxLength', '255');
            expect(descriptionInput).toHaveAttribute('maxLength', '1000');
        });
    });
});