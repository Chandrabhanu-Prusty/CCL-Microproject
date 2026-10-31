/**
 * Base HTTP API client for Marque frontend.
 * Reads base URL dynamically from VITE_API_BASE_URL.
 * Uses mock adapter ONLY when mock mode is explicitly enabled (VITE_USE_MOCK_API=true).
 * When VITE_API_BASE_URL is configured, performs real HTTP requests and never falls back to mock data.
 * Conforms to API_CONTRACT.md standard error format: { error: { code, message, details } }
 */

import { getAuthHeaders, getUser } from '../auth/authHelpers.js';
import { mockBackend } from './mockData.js';

export function getApiConfig() {
  const env =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env
      : typeof process !== 'undefined' && process.env
      ? process.env
      : {};

  const baseUrl = (env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
  const isExplicitMock = String(env.VITE_USE_MOCK_API || '').toLowerCase() === 'true';
  // Mock mode is active only when no base URL is set AND mock mode is explicitly enabled
  const mockMode = !baseUrl && isExplicitMock;

  return { baseUrl, isMockMode: mockMode };
}

export const isMockMode = getApiConfig().isMockMode;
export const BASE_URL = getApiConfig().baseUrl;

export async function apiRequest(endpoint, options = {}) {
  const { baseUrl, isMockMode: activeMockMode } = getApiConfig();

  // If mock mode is explicitly enabled, route to mock adapter
  if (activeMockMode) {
    return handleMockRequest(endpoint, options);
  }

  // If real API base URL is missing and mock mode is not enabled, throw clear error
  if (!baseUrl) {
    const error = new Error(
      'API base URL is not configured. Set VITE_API_BASE_URL in your environment, or set VITE_USE_MOCK_API=true for local mock mode.'
    );
    error.code = 'CONFIG_ERROR';
    error.status = 500;
    throw error;
  }

  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorObj = data?.error || {
        code: `HTTP_${res.status}`,
        message: data?.message || res.statusText || 'Request failed.',
      };
      const error = new Error(errorObj.message);
      error.code = errorObj.code;
      error.status = res.status;
      throw error;
    }

    return data;
  } catch (err) {
    // If backend responded with an HTTP status error, rethrow it directly
    if (err.status) {
      throw err;
    }

    // Network / connectivity error: NEVER silently fall back to mock data
    const message = `Unable to reach the Marque backend at ${baseUrl}. Please check your network connection, API Gateway deployment, and CORS settings.`;
    const netErr = new Error(message);
    netErr.code = 'NETWORK_ERROR';
    netErr.status = 0;
    netErr.originalError = err;
    throw netErr;
  }
}

/**
 * Maps standard API endpoints to the mockBackend implementation
 */
async function handleMockRequest(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const user = getUser();
  const body = options.body ? JSON.parse(options.body) : {};

  // Auth routes
  if (endpoint === '/api/auth/login' && method === 'POST') {
    const { email, password } = body;
    if (!email || !password) {
      throw { status: 400, code: 'VALIDATION_ERROR', message: 'Email and password required.' };
    }
    // Global roles are strictly ATTENDEE and ORGANIZER only.
    let role = 'ATTENDEE';
    let userId = 'usr-attendee-demo';
    let name = 'Chandrabhanu Prusty';

    if (email.includes('organizer')) {
      role = 'ORGANIZER';
      userId = 'usr-organizer-01';
      name = 'Neilsen Organizer';
    } else if (email.includes('coordinator')) {
      // Coordinator is an ATTENDEE holding event-specific CHECK_IN staff assignments
      role = 'ATTENDEE';
      userId = 'usr-coordinator-01';
      name = 'Preeti Coordinator';
    }

    const mockUser = {
      userId,
      name,
      email,
      role,
    };
    return {
      token: `mock-jwt-${Date.now()}`,
      user: mockUser,
    };
  }

  if (endpoint === '/api/auth/register' && method === 'POST') {
    const { name, email } = body;
    const mockUser = {
      userId: `usr-${Math.random().toString(36).substring(2, 9)}`,
      name: name || 'Campus Attendee',
      email,
      role: 'ATTENDEE', // API_CONTRACT: public registration always defaults to ATTENDEE
    };
    return {
      token: `mock-jwt-${Date.now()}`,
      user: mockUser,
    };
  }

  // Assigned events for coordinator
  if (endpoint === '/api/me/assigned-events' && method === 'GET') {
    return mockBackend.getAssignedEvents(user);
  }

  // Events routes
  if (endpoint.startsWith('/api/events')) {
    const cleanPath = endpoint.split('?')[0];
    const parts = cleanPath.split('/');

    // Event staff management: /api/events/:eventId/staff
    if (parts.length === 5 && parts[4] === 'staff') {
      const eventId = parts[3];
      if (method === 'GET') {
        return mockBackend.getEventStaff(eventId, user);
      }
      if (method === 'POST') {
        return mockBackend.assignCoordinator(eventId, body.email, user);
      }
    }

    // Remove coordinator: /api/events/:eventId/staff/:userId
    if (parts.length === 6 && parts[4] === 'staff' && method === 'DELETE') {
      const eventId = parts[3];
      const targetUserId = parts[5];
      return mockBackend.removeCoordinator(eventId, targetUserId, user);
    }

    // Attendees list: /api/events/:eventId/attendees
    if (parts.length === 5 && parts[4] === 'attendees' && method === 'GET') {
      const eventId = parts[3];
      const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
      return mockBackend.getAttendees(eventId, urlParams.get('q') || '', user);
    }

    // Event stats: /api/events/:eventId/stats
    if (parts.length === 5 && parts[4] === 'stats' && method === 'GET') {
      const eventId = parts[3];
      return mockBackend.getEventStats(eventId, user);
    }

    // Coordinator check-in summary: /api/events/:eventId/checkin-summary
    if (parts.length === 5 && parts[4] === 'checkin-summary' && method === 'GET') {
      const eventId = parts[3];
      return mockBackend.getCheckinSummary(eventId, user);
    }

    // Single event: /api/events/:eventId
    if (parts.length === 4 && parts[3]) {
      const eventId = parts[3];
      if (method === 'GET') {
        return mockBackend.getEventById(eventId);
      }
      if (method === 'PATCH') {
        return mockBackend.updateEvent(eventId, body, user);
      }
    }

    // Events list or creation
    if (parts.length === 3) {
      if (method === 'GET') {
        const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
        return mockBackend.getEvents({
          q: urlParams.get('q') || '',
          category: urlParams.get('category') || '',
        });
      }
      if (method === 'POST') {
        return mockBackend.createEvent(body, user);
      }
    }
  }

  // RSVP routes
  if (endpoint.match(/\/api\/events\/[^/]+\/rsvp/) && method === 'POST') {
    const eventId = endpoint.split('/')[3];
    return mockBackend.rsvpEvent(eventId, user);
  }

  if (endpoint.match(/\/api\/events\/[^/]+\/rsvp/) && method === 'DELETE') {
    const eventId = endpoint.split('/')[3];
    return mockBackend.cancelRsvp(eventId, user);
  }

  if (endpoint === '/api/me/rsvps' && method === 'GET') {
    return mockBackend.getMyRsvps(user);
  }

  // Tickets
  if (endpoint.startsWith('/api/tickets/') && method === 'GET') {
    const ticketId = endpoint.split('/')[3];
    return mockBackend.getTicketById(ticketId, user);
  }

  // Check-in
  if (endpoint.match(/\/api\/events\/[^/]+\/check-in/) && method === 'POST') {
    const eventId = endpoint.split('/')[3];
    return mockBackend.checkInTicket(eventId, body.ticketId, user);
  }

  // Presigned banner upload
  if (endpoint === '/api/uploads/banner-url' && method === 'POST') {
    if (user?.role !== 'ORGANIZER') {
      throw { status: 403, code: 'FORBIDDEN', message: 'Organizer permission required for banner uploads.' };
    }
    const { fileName, contentType } = body;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(contentType)) {
      throw { status: 400, code: 'INVALID_CONTENT_TYPE', message: 'Allowed banner formats are image/jpeg, image/png, image/webp.' };
    }
    return {
      uploadUrl: `https://mock-s3-upload.amazonaws.com/raw/${encodeURIComponent(fileName)}`,
      bannerUrl: `https://mock-s3-upload.amazonaws.com/banners/${encodeURIComponent(fileName)}`,
    };
  }

  // Helper methods on apiClient
  throw { status: 404, code: 'NOT_FOUND', message: `Mock route not mapped: ${method} ${endpoint}` };
}

// Export shorthand HTTP helpers
export default {
  get: (url, options = {}) => apiRequest(url, { ...options, method: 'GET' }),
  post: (url, body, options = {}) => apiRequest(url, { ...options, method: 'POST', body: JSON.stringify(body) }),
  patch: (url, body, options = {}) => apiRequest(url, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  delete: (url, options = {}) => apiRequest(url, { ...options, method: 'DELETE' }),
};
