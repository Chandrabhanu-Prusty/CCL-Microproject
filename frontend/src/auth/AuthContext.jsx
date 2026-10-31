/**
 * React Context for Authentication and Role Management.
 * Restricts demo auto-login and client-side role switching to explicit mock mode.
 * In real API mode, authentication and authorization are strictly backend-driven.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getToken, getUser, setToken, setUser, clearAuth } from './authHelpers';
import * as authService from '../services/authService';
import { isMockMode } from '../services/apiClient';

const AuthContext = createContext(null);

// Canonical demo personas for mock testing
const DEMO_PERSONAS = {
  ATTENDEE: {
    userId: 'usr-attendee-demo',
    email: 'chandrabhanu@example.com',
    name: 'Chandrabhanu Prusty',
    role: 'ATTENDEE',
  },
  ORGANIZER: {
    userId: 'usr-organizer-01',
    email: 'organizer.neilsen@example.com',
    name: 'Neilsen Organizer',
    role: 'ORGANIZER',
  },
  COORDINATOR: {
    userId: 'usr-coordinator-01',
    email: 'coordinator.preeti@example.com',
    name: 'Preeti Coordinator',
    role: 'COORDINATOR',
  },
};

export function AuthProvider({ children }) {
  const [user, setCurrentUser] = useState(null);
  const [token, setCurrentToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Rehydrate auth state on mount
    const savedToken = getToken();
    const savedUser = getUser();

    // When real API is configured, clear any residual mock tokens from past local tests
    if (!isMockMode && savedToken?.startsWith('mock-jwt')) {
      clearAuth();
      setCurrentToken(null);
      setCurrentUser(null);
      setLoading(false);
      return;
    }

    if (savedToken && savedUser) {
      setCurrentToken(savedToken);
      setCurrentUser(savedUser);
    } else {
      // User must sign in first; fresh visits start unauthenticated
      setCurrentToken(null);
      setCurrentUser(null);
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

  // Switch role for quick testing/grading across Attendee, Organizer, Coordinator in mock mode ONLY
  const switchRole = (newRole) => {
    if (!isMockMode) {
      console.warn(
        '[Marque Auth] Client-side role switching is restricted to mock mode. In real API mode, user roles are determined by backend authentication.'
      );
      return;
    }
    const persona = DEMO_PERSONAS[newRole] || {
      userId: `usr-${Date.now().toString(36)}`,
      email: `${newRole.toLowerCase()}@example.com`,
      name: `${newRole} User`,
      role: newRole,
    };
    setUser(persona);
    setCurrentUser(persona);
  };

  const role = user?.role || 'ATTENDEE';
  const isOrganizer = role === 'ORGANIZER';
  const isCoordinator = role === 'COORDINATOR';
  const isAttendee = role === 'ATTENDEE';

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    role,
    isOrganizer,
    isCoordinator,
    isAttendee,
    isMockMode,
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
