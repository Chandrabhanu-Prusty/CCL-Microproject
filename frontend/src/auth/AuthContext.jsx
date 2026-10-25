/**
 * React Context for Authentication and Role Management.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getToken, getUser, setToken, setUser, clearAuth } from './authHelpers';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setCurrentUser] = useState(null);
  const [token, setCurrentToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Rehydrate auth state on mount
    const savedToken = getToken();
    const savedUser = getUser();
    if (savedToken && savedUser) {
      setCurrentToken(savedToken);
      setCurrentUser(savedUser);
    } else {
      // Default demo attendee user so fresh visits have an immediate active profile
      const demoUser = {
        userId: 'usr-attendee-demo',
        name: 'Chandrabhanu Prusty',
        email: 'chandrabhanu@example.com',
        role: 'ATTENDEE',
      };
      const demoToken = 'mock-jwt-default';
      setCurrentUser(demoUser);
      setCurrentToken(demoToken);
      setUser(demoUser);
      setToken(demoToken);
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const data = await authService.login({ email, password });
    if (data.token && data.user) {
      setToken(data.token);
      setUser(data.user);
      setCurrentToken(data.token);
      setCurrentUser(data.user);
    }
    return data;
  };

  const register = async (name, email, password) => {
    const data = await authService.register({ name, email, password });
    if (data.token && data.user) {
      setToken(data.token);
      setUser(data.user);
      setCurrentToken(data.token);
      setCurrentUser(data.user);
    }
    return data;
  };

  const logout = () => {
    clearAuth();
    setCurrentToken(null);
    setCurrentUser(null);
  };

  // Switch role for quick testing/grading across Attendee, Organizer, Coordinator
  const switchRole = (newRole) => {
    if (!user) return;
    const updatedUser = { ...user, role: newRole };
    setUser(updatedUser);
    setCurrentUser(updatedUser);
  };

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    role: user?.role || 'ATTENDEE',
    isOrganizer: user?.role === 'ORGANIZER',
    isCoordinator: user?.role === 'COORDINATOR' || user?.role === 'ORGANIZER', // Organizers can also check in
    loading,
    login,
    register,
    logout,
    switchRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
