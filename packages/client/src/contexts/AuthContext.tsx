import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, setTokens, clearTokens, getTokens, User, LoginRequest, RegisterRequest, isApiError } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [error, setError] = useState<string | null>(null);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const queryClient = useQueryClient();
  const { setUser, setAuthenticated, user: storeUser, isAuthenticated: storeIsAuthenticated } = useAppStore();

  // Initialize tokens from localStorage on app start
  useEffect(() => {
    const storedTokens = localStorage.getItem('auth-tokens');
    if (storedTokens) {
      try {
        const { accessToken, refreshToken } = JSON.parse(storedTokens);
        if (accessToken && refreshToken) {
          setTokens(accessToken, refreshToken);
        }
      } catch (error) {
        console.error('Failed to parse stored tokens:', error);
        localStorage.removeItem('auth-tokens');
      }
    }
  }, []);

  // Query to get current user info - always enabled to check auth status
  const { data: userData, isLoading, error: queryError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.getMe,
    enabled: !storeUser, // Only run if we don't already have user data
    retry: false,
  });

  // Handle query success
  useEffect(() => {
    if (userData) {
      setUser(userData.user);
      setAuthenticated(true);
      setError(null);
      setInitialCheckComplete(true);
    }
  }, [userData, setUser, setAuthenticated]);

  // Handle query error or completion
  useEffect(() => {
    if (isLoading === false) {
      setInitialCheckComplete(true);
      
      if (queryError && !userData) {
        // Auth check failed - clear any stored tokens and set unauthenticated
        console.log('Authentication check failed, user needs to log in');
        clearTokens();
        localStorage.removeItem('auth-tokens');
        setUser(null);
        setAuthenticated(false);
      }
    }
  }, [isLoading, queryError, userData, setUser, setAuthenticated]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: authApi.login,
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: authApi.register,
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
  });

  // Logout all devices mutation
  const logoutAllMutation = useMutation({
    mutationFn: () => authApi.logoutAll(storeUser?.id || ''),
  });

  const login = async (data: LoginRequest) => {
    setError(null);
    try {
      const result = await loginMutation.mutateAsync(data);
      setTokens(result.accessToken, result.refreshToken);
      localStorage.setItem('auth-tokens', JSON.stringify({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      }));
      setUser(result.user);
      setAuthenticated(true);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    } catch (error) {
      console.error('Login failed:', error);
      if (isApiError(error)) {
        setError(error.response?.data.error?.message || 'Login failed');
      } else {
        setError('Login failed. Please try again.');
      }
      throw error;
    }
  };

  const register = async (data: RegisterRequest) => {
    setError(null);
    try {
      const result = await registerMutation.mutateAsync(data);
      setTokens(result.accessToken, result.refreshToken);
      localStorage.setItem('auth-tokens', JSON.stringify({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      }));
      setUser(result.user);
      setAuthenticated(true);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    } catch (error) {
      console.error('Registration failed:', error);
      if (isApiError(error)) {
        setError(error.response?.data.error?.message || 'Registration failed');
      } else {
        setError('Registration failed. Please try again.');
      }
      throw error;
    }
  };

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      clearTokens();
      localStorage.removeItem('auth-tokens');
      setUser(null);
      setAuthenticated(false);
      setError(null);
      queryClient.clear();
    }
  };

  const logoutAll = async () => {
    try {
      await logoutAllMutation.mutateAsync();
    } finally {
      clearTokens();
      localStorage.removeItem('auth-tokens');
      setUser(null);
      setAuthenticated(false);
      setError(null);
      queryClient.clear();
    }
  };

  const clearError = () => {
    setError(null);
  };

  const contextValue: AuthContextType = {
    user: storeUser,
    isAuthenticated: storeIsAuthenticated,
    isLoading: !initialCheckComplete || loginMutation.isPending || registerMutation.isPending,
    error,
    login,
    register,
    logout,
    logoutAll,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};