import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/auth.service.js';
import { useToast } from './ToastContext.jsx';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const toast = useToast();

  // Rehydrate authenticated session via GET /api/auth/me
  const rehydrate = useCallback(async () => {
    const token = authService.getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await authService.getMe();
      if (res && res.user) {
        setUser(res.user);
      } else {
        authService.logout();
        setUser(null);
      }
    } catch (err) {
      // Safe cleanup for expired/invalid session without logging sensitive details
      authService.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize session on mount
  useEffect(() => {
    rehydrate();
  }, [rehydrate]);

  // Listen for unauthorized 401 events dispatched by api client interceptor
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser((currentUser) => {
        if (currentUser) {
          toast.error('Session expired. Please log in again.');
        }
        return null;
      });
      authService.logout();
    };

    window.addEventListener('ricozingest:auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('ricozingest:auth:unauthorized', handleUnauthorized);
    };
  }, [toast]);

  /**
   * Login with email and password
   * Persists JWT via authService.login and sets authenticated user in state
   */
  const login = useCallback(async (email, password) => {
    setAuthError(null);
    try {
      const response = await authService.login({ email, password });
      if (response && response.user) {
        setUser(response.user);
        toast.success(response.message || 'Login successful!');
        return response;
      }
      throw new Error('Authentication response is missing user information');
    } catch (err) {
      const message = err.message || 'Login failed. Please check your credentials.';
      setAuthError(message);
      throw err;
    }
  }, [toast]);

  /**
   * Register a new user account
   */
  const register = useCallback(async (name, email, password) => {
    setAuthError(null);
    try {
      const response = await authService.register({ name, email, password });
      toast.success(response.message || 'Account registered successfully!');
      return response;
    } catch (err) {
      const message = err.message || 'Registration failed.';
      setAuthError(message);
      throw err;
    }
  }, [toast]);

  /**
   * Logout user and clear stored JWT
   */
  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setAuthError(null);
    toast.info('You have been logged out.');
  }, [toast]);

  const value = {
    user,
    loading,
    authError,
    isAuthenticated: Boolean(user && authService.isAuthenticated()),
    login,
    register,
    logout,
    rehydrate
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
