import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UserSwitcher } from '../UserSwitcher';

// Mock the auth context
const mockLogout = vi.fn();
const mockLogoutAll = vi.fn();

const mockUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user' as const,
  organizationId: 'org-123',
  preferences: {
    timeFormat: '24h' as const,
    weekStartDay: 1,
    notifications: true,
  },
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
};

vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
    logoutAll: mockLogoutAll,
    isLoading: false,
  }),
}));

describe('UserSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders user information', () => {
    render(<UserSwitcher />);

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('T')).toBeInTheDocument(); // Avatar initial
  });

  it('shows dropdown when clicked', async () => {
    const user = userEvent.setup();
    render(<UserSwitcher />);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(screen.getByText('Org: org-123')).toBeInTheDocument();
    expect(screen.getByText('user')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
    expect(screen.getByText('Sign out all devices')).toBeInTheDocument();
  });

  it('calls logout when sign out is clicked', async () => {
    const user = userEvent.setup();
    render(<UserSwitcher />);

    const button = screen.getByRole('button');
    await user.click(button);

    const signOutButton = screen.getByText('Sign out');
    await user.click(signOutButton);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledOnce();
    });
  });

  it('calls logoutAll when sign out all devices is clicked', async () => {
    const user = userEvent.setup();
    render(<UserSwitcher />);

    const button = screen.getByRole('button');
    await user.click(button);

    const signOutAllButton = screen.getByText('Sign out all devices');
    await user.click(signOutAllButton);

    await waitFor(() => {
      expect(mockLogoutAll).toHaveBeenCalledOnce();
    });
  });
});