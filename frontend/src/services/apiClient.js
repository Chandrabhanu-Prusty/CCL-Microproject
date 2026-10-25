/**
 * Base HTTP API client for Marque frontend.
 * Reads base URL dynamically from VITE_API_BASE_URL.
 * Seamlessly delegates to mockBackend when VITE_API_BASE_URL is not set.
 * Conforms to API_CONTRACT.md standard error format: { error: { code, message } }
 */

import { getAuthHeaders, getUser } from '../auth/authHelpers';
import { mockBackend } from './mockData';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export async function apiRequest(endpoint, options = {}) {
  const isMockMode = !BASE_URL;

  // If no external API configured, run with mock adapter
  if (isMockMode) {
    return handleMockRequest(endpoint, options);
  }

  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
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
    // If backend is configured but network fails, log clear diagnostic
    if (err.status) {
      throw err;
    }
    console.warn(`[Marque API] Connection failed to ${url}, falling back to mock adapter for demonstration.`, err);
    return handleMockRequest(endpoint, options);
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
    // Determine demo role from email or default to ATTENDEE
    let role = 'ATTENDEE';
    if (email.includes('organizer')) role = 'ORGANIZER';
    if (email.includes('coordinator')) role = 'COORDINATOR';

    const mockUser = {
      userId: `usr-${Math.random().toString(36).substring(2, 9)}`,
      name: email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
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

  // Events routes
  if (endpoint.startsWith('/api/events') && method === 'GET') {
    const parts = endpoint.split('?')[0].split('/');
    // Check if it's /api/events/:eventId/attendees
    if (parts.length === 5 && parts[4] === 'attendees') {
      const eventId = parts[3];
      const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
      return mockBackend.getAttendees(eventId, urlParams.get('q') || '');
    }
    // Check if it's /api/events/:eventId/stats
    if (parts.length === 5 && parts[4] === 'stats') {
      const eventId = parts[3];
      return mockBackend.getEventStats(eventId);
    }
    // Single event /api/events/:eventId
    if (parts.length === 4 && parts[3]) {
      const eventId = parts[3];
      return mockBackend.getEventById(eventId);
    }
    // Event list
    const urlParams = new URLSearchParams(endpoint.split('?')[1] || '');
    return mockBackend.getEvents({
      q: urlParams.get('q') || '',
      category: urlParams.get('category') || '',
    });
  }

  if (endpoint === '/api/events' && method === 'POST') {
    return mockBackend.createEvent(body, user);
  }

  if (endpoint.startsWith('/api/events/') && method === 'PATCH') {
    const eventId = endpoint.split('/')[3];
    return mockBackend.updateEvent(eventId, body, user);
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
    return mockBackend.getTicketById(ticketId);
  }

  // Check-in
  if (endpoint.match(/\/api\/events\/[^/]+\/check-in/) && method === 'POST') {
    const eventId = endpoint.split('/')[3];
    return mockBackend.checkInTicket(eventId, body.ticketId, user?.userId);
  }

  // Fallback
  throw { status: 404, code: 'NOT_FOUND', message: `Mock route not mapped: ${method} ${endpoint}` };
}
