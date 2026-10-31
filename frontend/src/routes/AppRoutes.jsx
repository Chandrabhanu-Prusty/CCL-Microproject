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
 * Organizer Route Guard.
 * Restricts access strictly to accounts with global role ORGANIZER.
 */
function OrganizerRoute({ children }) {
  const { isAuthenticated, isOrganizer, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner message="Verifying organizer privileges..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  if (!isOrganizer) {
    return <Navigate to="/events" replace />;
  }

  return children;
}

/**
 * Staff Check-in Route Guard.
 * Restricts access to users who hold live event staff check-in assignments (or mock staff).
 */
function CheckinRoute({ children }) {
  const { isAuthenticated, isCoordinator, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner message="Verifying check-in staff authorization..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  if (!isCoordinator) {
    // If user has no assigned events, redirect to events catalog
    return <Navigate to="/events" replace />;
  }

  return children;
}

/**
 * Guest-only route wrapper for AuthPage.
 * If user is already signed in, redirect them directly based on role.
 */
function GuestRoute({ children }) {
  const { isAuthenticated, isOrganizer, isCoordinator, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner message="Checking session..." />;
  }

  if (isAuthenticated) {
    if (isOrganizer) return <Navigate to="/organizer" replace />;
    if (isCoordinator) return <Navigate to="/checkin" replace />;
    return <Navigate to="/events" replace />;
  }

  return children;
}

export default function AppRoutes() {
  const { isAuthenticated, isOrganizer, isCoordinator, loading } = useAuth();

  const getHomeRedirect = () => {
    if (!isAuthenticated) return '/auth';
    if (isOrganizer) return '/organizer';
    if (isCoordinator) return '/checkin';
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

        {/* Campus Event Discovery (All authenticated users: Attendee, Organizer) */}
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

        {/* Organizer Dashboard (Strictly ORGANIZER global role only) */}
        <Route
          path="organizer"
          element={
            <OrganizerRoute>
              <OrganizerDashboardPage />
            </OrganizerRoute>
          }
        />

        {/* Coordinator Check-in Workspace (Live event assignments required) */}
        <Route
          path="checkin"
          element={
            <CheckinRoute>
              <CoordinatorCheckinPage />
            </CheckinRoute>
          }
        />
        <Route
          path="checkin/:eventId"
          element={
            <CheckinRoute>
              <CoordinatorCheckinPage />
            </CheckinRoute>
          }
        />

        {/* 404 Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
