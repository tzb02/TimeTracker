import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ExportButtons } from '../ExportButtons';
import { AuthProvider } from '../../../contexts/AuthContext';
import * as api from '../../../lib/api';

// Mock the API
vi.mock('../../../lib/api', () => ({
  reportApi: {
    exportData: vi.fn(),
  },
}));

const mockReportApi = api.reportApi as any;

// Mock AuthContext
const mockUser = {
  id: 'user1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user' as const,
  preferences: {
    timeFormat: '24h' as const,
    weekStartDay: 1,
    notifications: true,
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    login: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
  }),
}));

// Mock URL.createObjectURL and related functions
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  },
});

// Mock document.createElement and appendChild
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
Object.defineProperty(document, 'createElement', {
  value: vi.fn(() => ({
    href: '',
    download: '',
    click: mockClick,
  })),
});
Object.defineProperty(document.body, 'appendChild', {
  value: mockAppendChild,
});
Object.defineProperty(document.body, 'removeChild', {
  value: mockRemoveChild,
});

describe('ExportButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateObjectURL.mockReturnValue('blob:mock-url');
  });

  it('renders export buttons', () => {
    render(<ExportButtons />);

    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText('Export PDF')).toBeInTheDocument();
  });

  it('exports CSV when CSV button is clicked', async () => {
    const mockBlob = new Blob(['csv,data'], { type: 'text/csv' });
    mockReportApi.exportData.mockResolvedValue(mockBlob);

    render(<ExportButtons />);

    fireEvent.click(screen.getByText('Export CSV'));

    expect(screen.getByText('Exporting...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockReportApi.exportData).toHaveBeenCalledWith('csv', undefined);
    });

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(mockClick).toHaveBeenCalled();
    });
  });

  it('exports PDF when PDF button is clicked', async () => {
    const mockBlob = new Blob(['pdf data'], { type: 'application/pdf' });
    mockReportApi.exportData.mockResolvedValue(mockBlob);

    render(<ExportButtons />);

    fireEvent.click(screen.getByText('Export PDF'));

    expect(screen.getByText('Exporting...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockReportApi.exportData).toHaveBeenCalledWith('pdf', undefined);
    });

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(mockClick).toHaveBeenCalled();
    });
  });

  it('passes filters to export function', async () => {
    const filters = {
      dateRange: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      },
      projectIds: ['project1'],
    };

    const mockBlob = new Blob(['csv,data'], { type: 'text/csv' });
    mockReportApi.exportData.mockResolvedValue(mockBlob);

    render(<ExportButtons filters={filters} />);

    fireEvent.click(screen.getByText('Export CSV'));

    await waitFor(() => {
      expect(mockReportApi.exportData).toHaveBeenCalledWith('csv', filters);
    });
  });

  it('disables buttons while exporting', async () => {
    const mockBlob = new Blob(['csv,data'], { type: 'text/csv' });
    mockReportApi.exportData.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockBlob), 100)));

    render(<ExportButtons />);

    fireEvent.click(screen.getByText('Export CSV'));

    expect(screen.getByText('Export PDF')).toBeDisabled();
    
    await waitFor(() => {
      expect(screen.queryByText('Exporting...')).not.toBeInTheDocument();
    });
  });

  it('handles export errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockReportApi.exportData.mockRejectedValue(new Error('Export failed'));

    render(<ExportButtons />);

    fireEvent.click(screen.getByText('Export CSV'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error exporting csv:', expect.any(Error));
    });

    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText('Export PDF')).not.toBeDisabled();

    consoleSpy.mockRestore();
  });
});