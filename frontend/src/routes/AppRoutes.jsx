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
 * Guest-only route wrapper for AuthPage.
 * If user is already signed in, redirect them directly to events catalog.
 */
function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner message="Checking session..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/events" replace />;
  }

  return children;
}

export default function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        {/* On root visit, if not logged in, show Login/Sign-in page first */}
        <Route
          index
          element={
            loading ? (
              <LoadingSpinner message="Initializing Marque..." />
            ) : isAuthenticated ? (
              <Navigate to="/events" replace />
            ) : (
              <Navigate to="/auth" replace />
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

        {/* Protected Campus Event Pages (Requires Login) */}
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

        {/* Attendee Registrations & Digital Passes (Requires Login) */}
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

        {/* Organizer Dashboard (Requires Login) */}
        <Route
          path="organizer"
          element={
            <ProtectedRoute>
              <OrganizerDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Coordinator Check-in (Requires Login) */}
        <Route
          path="checkin"
          element={
            <ProtectedRoute>
              <CoordinatorCheckinPage />
            </ProtectedRoute>
          }
        />

        {/* 404 Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
