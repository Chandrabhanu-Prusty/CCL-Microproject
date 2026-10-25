/**
 * Check-in and Organizer Analytics API Service
 * Conforms to API_CONTRACT.md
 */

import { apiRequest } from './apiClient';

export async function getAttendees(eventId, query = '') {
  const qs = query ? `?q=${encodeURIComponent(query)}` : '';
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/attendees${qs}`);
}

export async function checkInTicket(eventId, ticketId) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/check-in`, {
    method: 'POST',
    body: JSON.stringify({ ticketId }),
  });
}

export async function getEventStats(eventId) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/stats`);
}
