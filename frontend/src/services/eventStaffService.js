import apiClient from './apiClient';

/**
 * Event Staff Service
 * Handles coordinator assignments and event-scoped check-in authorization
 */

/**
 * List all coordinators/staff assigned to a specific event (Organizer only)
 * GET /api/events/{eventId}/staff
 */
export async function getEventStaff(eventId) {
  return apiClient.get(`/api/events/${eventId}/staff`);
}

/**
 * Assign a coordinator to an event by email (Organizer only)
 * POST /api/events/{eventId}/staff
 * Body: { email: string }
 */
export async function assignCoordinator(eventId, email) {
  return apiClient.post(`/api/events/${eventId}/staff`, { email });
}

/**
 * Remove a coordinator assignment from an event (Organizer only)
 * DELETE /api/events/{eventId}/staff/{userId}
 */
export async function removeCoordinator(eventId, userId) {
  return apiClient.delete(`/api/events/${eventId}/staff/${userId}`);
}

/**
 * List events assigned to the currently authenticated coordinator
 * GET /api/me/assigned-events
 */
export async function getAssignedEvents() {
  return apiClient.get('/api/me/assigned-events');
}
