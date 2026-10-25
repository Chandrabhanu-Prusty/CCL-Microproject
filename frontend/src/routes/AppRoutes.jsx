import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import EventListPage from '../pages/EventListPage';
import EventDetailPage from '../pages/EventDetailPage';
import AuthPage from '../pages/AuthPage';
import MyRegistrationsPage from '../pages/MyRegistrationsPage';
import TicketPage from '../pages/TicketPage';
import OrganizerDashboardPage from '../pages/OrganizerDashboardPage';
import CoordinatorCheckinPage from '../pages/CoordinatorCheckinPage';
import NotFoundPage from '../pages/NotFoundPage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        {/* Default redirect to events discovery */}
        <Route index element={<Navigate to="/events" replace />} />

        {/* Public Event Discovery */}
        <Route path="events" element={<EventListPage />} />
        <Route path="events/:eventId" element={<EventDetailPage />} />

        {/* Authentication */}
        <Route path="auth" element={<AuthPage />} />

        {/* Attendee Registrations & Ticket */}
        <Route path="my-registrations" element={<MyRegistrationsPage />} />
        <Route path="tickets/:ticketId" element={<TicketPage />} />

        {/* Organizer Dashboard */}
        <Route path="organizer" element={<OrganizerDashboardPage />} />

        {/* Coordinator Check-in */}
        <Route path="checkin" element={<CoordinatorCheckinPage />} />

        {/* 404 Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
