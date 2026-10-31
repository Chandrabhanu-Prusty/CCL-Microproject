/**
 * Events API Service
 * Conforms to API_CONTRACT.md
 */

import { apiRequest } from './apiClient';

export async function getEvents(params = {}) {
  const query = new URLSearchParams();
  if (params.q) query.append('q', params.q);
  if (params.category && params.category !== 'All') query.append('category', params.category);

  const qs = query.toString();
  return apiRequest(`/api/events${qs ? `?${qs}` : ''}`);
}

export async function getEventById(eventId) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}`);
}

export async function createEvent(eventData) {
  return apiRequest('/api/events', {
    method: 'POST',
    body: JSON.stringify(eventData),
  });
}

export async function updateEvent(eventId, eventData) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(eventData),
  });
}
