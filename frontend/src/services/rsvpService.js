/**
 * RSVP and Registrations API Service
 * Conforms to API_CONTRACT.md
 */

import { apiRequest } from './apiClient';

export async function rsvpEvent(eventId) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/rsvp`, {
    method: 'POST',
  });
}

export async function cancelRsvp(eventId) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/rsvp`, {
    method: 'DELETE',
  });
}

export async function getMyRsvps() {
  return apiRequest('/api/me/rsvps');
}
