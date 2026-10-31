import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import EventListPage from '../pages/EventListPage';
import EventDetailPage from '../pages/EventDetailPage';
import AuthPage from '../pages/AuthPage';
import MyRegistrationsPage from '../pages/MyRegistrationsPage';
import TicketPage from '../pages/TicketPage';
import OrganizerDashboardPage from '../pages/OrganizerDashboardPage';
import CoordinatorCheckinPage from '../pages/CoordinatorCheckinPage';
import NotFoundPage from '../pages/NotFoundPage';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../auth/AuthContext';

/**
 * Route protection wrapper.
 * Unauthenticated users are redirected to the Login/Sign-in page.
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner message="Checking campus authentication..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  return children;
}

/**
 * Role-Based Route Guard.
 * Restricts access to specified roles. Unauthorized users are redirected to fallbackPath.
 */
function RoleRoute({ allowedRoles, fallbackPath = '/events', children }) {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner message="Checking permissions..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
}

/**
 * Guest-only route wrapper for AuthPage.
 * If user is already signed in, redirect them directly based on role.
 */
function GuestRoute({ children }) {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner message="Checking session..." />;
  }

  if (isAuthenticated) {
    if (role === 'ORGANIZER') return <Navigate to="/organizer" replace />;
    if (role === 'COORDINATOR') return <Navigate to="/checkin" replace />;
    return <Navigate to="/events" replace />;
  }

  return children;
}

export default function AppRoutes() {
  const { isAuthenticated, role, loading } = useAuth();

  const getHomeRedirect = () => {
    if (!isAuthenticated) return '/auth';
    if (role === 'ORGANIZER') return '/organizer';
    if (role === 'COORDINATOR') return '/checkin';
    return '/events';
  };

  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        {/* On root visit, redirect intelligently based on session & role */}
        <Route
          index
          element={
            loading ? (
              <LoadingSpinner message="Initializing Marque..." />
            ) : (
              <Navigate to={getHomeRedirect()} replace />
            )
          }
        />

        {/* Authentication Page (Guest only) */}
        <Route
          path="auth"
          element={
            <GuestRoute>
              <AuthPage />
            </GuestRoute>
          }
        />

        {/* Campus Event Discovery (All authenticated users: Attendee, Organizer, Coordinator) */}
        <Route
          path="events"
          element={
            <ProtectedRoute>
              <EventListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="events/:eventId"
          element={
            <ProtectedRoute>
              <EventDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Attendee Registrations & Digital Passes (All authenticated users can RSVP and hold personal passes) */}
        <Route
          path="my-registrations"
          element={
            <ProtectedRoute>
              <MyRegistrationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="tickets/:ticketId"
          element={
            <ProtectedRoute>
              <TicketPage />
            </ProtectedRoute>
          }
        />

        {/* Organizer Dashboard (Strictly ORGANIZER role only) */}
        <Route
          path="organizer"
          element={
            <RoleRoute allowedRoles={['ORGANIZER']} fallbackPath="/events">
              <OrganizerDashboardPage />
            </RoleRoute>
          }
        />

        {/* Coordinator Check-in Workspace (COORDINATOR and ORGANIZER roles only) */}
        <Route
          path="checkin"
          element={
            <RoleRoute allowedRoles={['COORDINATOR', 'ORGANIZER']} fallbackPath="/events">
              <CoordinatorCheckinPage />
            </RoleRoute>
          }
        />
        <Route
          path="checkin/:eventId"
          element={
            <RoleRoute allowedRoles={['COORDINATOR', 'ORGANIZER']} fallbackPath="/events">
              <CoordinatorCheckinPage />
            </RoleRoute>
          }
        />

        {/* 404 Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
