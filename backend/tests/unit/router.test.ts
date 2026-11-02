import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { routeRequest } from '../../src/router/index.js';
import { handler } from '../../src/index.js';
import { resetEnvCache, getEnv } from '../../src/config/env.js';
import { AppError } from '../../src/utils/errors.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

describe('Router Unit Tests', () => {
  const testEnv = {
    USERS_TABLE: 'MarqueUsers',
    EVENTS_TABLE: 'MarqueEvents',
    EVENT_STAFF_TABLE: 'MarqueEventStaff',
    RSVPS_TABLE: 'MarqueRSVPs',
    WAITLIST_TABLE: 'MarqueWaitlist',
    TICKETS_TABLE: 'MarqueTickets',
    S3_BUCKET: 'actual-s3-bucket-name',
    JWT_SECRET: 'super-secret-key-that-is-at-least-32-chars-long',
    JWT_EXPIRES_IN: '24h',
  };

  const createEvent = (
    method: string,
    rawPath: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): APIGatewayProxyEventV2 => {
    return {
      version: '2.0',
      routeKey: `${method} ${rawPath}`,
      rawPath,
      rawQueryString: '',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:5173',
        ...headers,
      },
      requestContext: {
        http: { method, path: rawPath, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' },
        accountId: '123456789012',
        apiId: 'api-id',
        domainName: 'localhost',
        domainPrefix: 'localhost',
        requestId: 'req-id',
        routeKey: `${method} ${rawPath}`,
        stage: '$default',
        time: '01/Nov/2026:10:00:00 +0000',
        timeEpoch: 1600000000,
      },
      isBase64Encoded: false,
      body: body ? JSON.stringify(body) : undefined,
    };
  };

  test('routes POST /api/auth/register to registerHandler', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      register: async () => ({
        token: 'mock.token',
        user: { userId: 'usr-1', name: 'User 1', email: 'u1@vesit.edu', role: 'ATTENDEE' as const },
      }),
    } as any;

    const event = createEvent('POST', '/api/auth/register', {
      name: 'User 1',
      email: 'u1@vesit.edu',
      password: 'ValidPassword123!',
    });

    const res = await routeRequest(event, { authService: mockAuthService }) as any;
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.token, 'mock.token');
  });

  test('routes POST /api/auth/login to loginHandler', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      login: async () => ({
        token: 'mock.login.token',
        user: { userId: 'usr-1', name: 'User 1', email: 'u1@vesit.edu', role: 'ATTENDEE' as const },
      }),
    } as any;

    const event = createEvent('POST', '/api/auth/login', {
      email: 'u1@vesit.edu',
      password: 'ValidPassword123!',
    });

    const res = await routeRequest(event, { authService: mockAuthService }) as any;
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.token, 'mock.login.token');
  });

  test('routes GET /api/auth/me to meHandler', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      verifyToken: () => ({ userId: 'usr-me-1', email: 'me@vesit.edu', role: 'ATTENDEE' as const }),
      getProfile: async () => ({ userId: 'usr-me-1', name: 'Me User', email: 'me@vesit.edu', role: 'ATTENDEE' as const }),
    } as any;

    const event = createEvent('GET', '/api/auth/me', undefined, {
      authorization: 'Bearer valid.jwt.token',
    });

    const res = await routeRequest(event, { authService: mockAuthService }) as any;
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.user.userId, 'usr-me-1');
  });

  test('routes GET /api/events to listEventsHandler', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockEventService = {
      listEvents: async () => [
        { eventId: 'evt-1', title: 'Event 1', confirmedCount: 5, capacity: 50 },
      ],
    } as any;

    const event = createEvent('GET', '/api/events');
    const res = await routeRequest(event, { eventService: mockEventService }) as any;
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.events.length, 1);
    assert.equal(body.events[0].eventId, 'evt-1');
  });

  test('routes POST /api/events to createEventHandler', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      verifyToken: () => ({ userId: 'usr-org-1', email: 'org@vesit.edu', role: 'ORGANIZER' as const }),
    } as any;

    const mockEventService = {
      createEvent: async (_orgId: string, input: any) => ({
        eventId: 'evt-new-1',
        ...input,
        confirmedCount: 0,
        status: 'PUBLISHED',
        organizerId: 'usr-org-1',
      }),
    } as any;

    const event = createEvent('POST', '/api/events', {
      title: 'Workshop',
      description: 'Hands-on',
      category: 'Workshop',
      startAt: '2026-11-28T14:00:00.000Z',
      venue: 'Lab 502',
      capacity: 30,
    }, {
      authorization: 'Bearer valid.org.token',
    });

    const res = await routeRequest(event, { authService: mockAuthService, eventService: mockEventService }) as any;
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.event.eventId, 'evt-new-1');
    assert.equal(body.event.organizerId, 'usr-org-1');
  });

  test('createEventHandler rejects past startAt with 400 VALIDATION_ERROR', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      verifyToken: () => ({ userId: 'usr-org-1', email: 'org@vesit.edu', role: 'ORGANIZER' as const }),
    } as any;

    const event = createEvent('POST', '/api/events', {
      title: 'Past Event',
      description: 'Test past date',
      category: 'Technology',
      startAt: '2020-01-01T10:00:00.000Z',
      venue: 'Room 101',
      capacity: 50,
    }, {
      authorization: 'Bearer valid.org.token',
    });

    const res = await routeRequest(event, { authService: mockAuthService }) as any;
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.match(body.error.message, /startAt must be a future date/);
  });

  test('createEventHandler rejects invalid ISO 8601 string for startAt with 400 VALIDATION_ERROR', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      verifyToken: () => ({ userId: 'usr-org-1', email: 'org@vesit.edu', role: 'ORGANIZER' as const }),
    } as any;

    const event = createEvent('POST', '/api/events', {
      title: 'Invalid Date Event',
      description: 'Test invalid format',
      category: 'Technology',
      startAt: '2027/01/01 10:00:00', // Non-ISO format
      venue: 'Room 101',
      capacity: 50,
    }, {
      authorization: 'Bearer valid.org.token',
    });

    const res = await routeRequest(event, { authService: mockAuthService }) as any;
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.match(body.error.message, /Must be a valid ISO 8601 date string/);
  });

  test('createEventHandler rejects endAt earlier than or equal to startAt with 400 VALIDATION_ERROR', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      verifyToken: () => ({ userId: 'usr-org-1', email: 'org@vesit.edu', role: 'ORGANIZER' as const }),
    } as any;

    const event = createEvent('POST', '/api/events', {
      title: 'Inverted Dates Event',
      description: 'Test endAt before startAt',
      category: 'Technology',
      startAt: '2027-10-15T12:00:00.000Z',
      endAt: '2027-10-14T12:00:00.000Z',
      venue: 'Room 101',
      capacity: 50,
    }, {
      authorization: 'Bearer valid.org.token',
    });

    const res = await routeRequest(event, { authService: mockAuthService }) as any;
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.match(body.error.message, /endAt must be after startAt/);
  });

  test('routes GET /api/events/{eventId} and extracts eventId parameter', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let receivedId = '';
    const mockEventService = {
      getEventById: async (id: string) => {
        receivedId = id;
        return { eventId: id, title: 'Single Event' };
      },
    } as any;

    const event = createEvent('GET', '/api/events/evt-target-123');
    const res = await routeRequest(event, { eventService: mockEventService }) as any;
    assert.equal(res.statusCode, 200);
    assert.equal(receivedId, 'evt-target-123');
  });

  test('routes PATCH /api/events/{eventId} and extracts eventId parameter', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      verifyToken: () => ({ userId: 'usr-org-1', email: 'org@vesit.edu', role: 'ORGANIZER' as const }),
    } as any;

    let updatedId = '';
    const mockEventService = {
      updateEvent: async (id: string) => {
        updatedId = id;
        return { eventId: id, title: 'Updated Title' };
      },
    } as any;

    const event = createEvent('PATCH', '/api/events/evt-target-123', {
      title: 'Updated Title',
    }, {
      authorization: 'Bearer valid.org.token',
    });

    const res = await routeRequest(event, { authService: mockAuthService, eventService: mockEventService }) as any;
    assert.equal(res.statusCode, 200);
    assert.equal(updatedId, 'evt-target-123');
  });

  test('updateEventHandler rejects past startAt with 400 VALIDATION_ERROR', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      verifyToken: () => ({ userId: 'usr-org-1', email: 'org@vesit.edu', role: 'ORGANIZER' as const }),
    } as any;

    const event = createEvent('PATCH', '/api/events/evt-target-123', {
      startAt: '2020-01-01T10:00:00.000Z',
    }, {
      authorization: 'Bearer valid.org.token',
    });

    const res = await routeRequest(event, { authService: mockAuthService }) as any;
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.match(body.error.message, /startAt must be a future date/);
  });

  test('updateEventHandler rejects endAt earlier than startAt when both provided with 400 VALIDATION_ERROR', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      verifyToken: () => ({ userId: 'usr-org-1', email: 'org@vesit.edu', role: 'ORGANIZER' as const }),
    } as any;

    const event = createEvent('PATCH', '/api/events/evt-target-123', {
      startAt: '2027-10-15T12:00:00.000Z',
      endAt: '2027-10-14T12:00:00.000Z',
    }, {
      authorization: 'Bearer valid.org.token',
    });

    const res = await routeRequest(event, { authService: mockAuthService }) as any;
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.match(body.error.message, /endAt must be after startAt/);
  });

  test('updateEventHandler returns HTTP 400 INVALID_CAPACITY when capacity race condition occurs', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      verifyToken: () => ({ userId: 'usr-org-1', email: 'org@vesit.edu', role: 'ORGANIZER' as const }),
    } as any;

    const mockEventService = {
      updateEvent: async () => {
        throw new AppError(
          400,
          'INVALID_CAPACITY',
          'Requested capacity is less than existing confirmed attendees.'
        );
      },
    } as any;

    const event = createEvent('PATCH', '/api/events/evt-target-123', {
      capacity: 50,
    }, {
      authorization: 'Bearer valid.org.token',
    });

    const res = await routeRequest(event, { authService: mockAuthService, eventService: mockEventService }) as any;
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, 'INVALID_CAPACITY');
    assert.match(body.error.message, /Requested capacity is less than existing confirmed attendees/);
  });

  test('routes GET /api/events/{eventId}/staff and extracts eventId', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      verifyToken: () => ({ userId: 'usr-org-1', email: 'org@vesit.edu', role: 'ORGANIZER' as const }),
    } as any;

    let staffEventId = '';
    const mockStaffService = {
      listStaff: async (id: string) => {
        staffEventId = id;
        return [{ eventId: id, userId: 'usr-s1', permission: 'CHECK_IN' }];
      },
    } as any;

    const event = createEvent('GET', '/api/events/evt-staff-456/staff', undefined, {
      authorization: 'Bearer valid.org.token',
    });

    const res = await routeRequest(event, { authService: mockAuthService, staffService: mockStaffService }) as any;
    assert.equal(res.statusCode, 200);
    assert.equal(staffEventId, 'evt-staff-456');
  });

  test('routes POST /api/events/{eventId}/staff to assign coordinator', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      verifyToken: () => ({ userId: 'usr-org-1', email: 'org@vesit.edu', role: 'ORGANIZER' as const }),
    } as any;

    const mockStaffService = {
      assignStaff: async (id: string, _caller: any, email: string) => ({
        eventId: id,
        userId: 'usr-coord-1',
        email,
        permission: 'CHECK_IN',
      }),
    } as any;

    const event = createEvent('POST', '/api/events/evt-staff-456/staff', {
      email: 'coord@vesit.edu',
    }, {
      authorization: 'Bearer valid.org.token',
    });

    const res = await routeRequest(event, { authService: mockAuthService, staffService: mockStaffService }) as any;
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.assignment.email, 'coord@vesit.edu');
  });

  test('routes DELETE /api/events/{eventId}/staff/{userId} to revoke coordinator', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      verifyToken: () => ({ userId: 'usr-org-1', email: 'org@vesit.edu', role: 'ORGANIZER' as const }),
    } as any;

    let revoked = { eventId: '', userId: '' };
    const mockStaffService = {
      revokeStaff: async (eid: string, _caller: any, uid: string) => {
        revoked = { eventId: eid, userId: uid };
      },
    } as any;

    const event = createEvent('DELETE', '/api/events/evt-staff-456/staff/usr-coord-999', undefined, {
      authorization: 'Bearer valid.org.token',
    });

    const res = await routeRequest(event, { authService: mockAuthService, staffService: mockStaffService }) as any;
    assert.equal(res.statusCode, 200);
    assert.equal(revoked.eventId, 'evt-staff-456');
    assert.equal(revoked.userId, 'usr-coord-999');
  });

  test('routes GET /api/me/assigned-events to listAssignedEventsHandler', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      verifyToken: () => ({ userId: 'usr-staff-1', email: 'staff@vesit.edu', role: 'ATTENDEE' as const }),
    } as any;

    const mockStaffService = {
      listAssignedEvents: async () => [
        { eventId: 'evt-assigned-1', title: 'Assigned Hackathon' },
      ],
    } as any;

    const event = createEvent('GET', '/api/me/assigned-events', undefined, {
      authorization: 'Bearer valid.token',
    });

    const res = await routeRequest(event, { authService: mockAuthService, staffService: mockStaffService }) as any;
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.events.length, 1);
  });

  test('routes POST /api/events/{eventId}/rsvp to rsvpEventHandler', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      verifyToken: () => ({ userId: 'usr-att-1', email: 'att@vesit.edu', role: 'ATTENDEE' as const }),
    } as any;

    const mockRsvpService = {
      rsvpEvent: async (eid: string, _caller: any) => ({
        status: 'CONFIRMED',
        rsvpId: 'rsvp-test-1',
        ticketId: 'tkt-test-1',
        message: 'Registration confirmed. Your digital pass is available.',
      }),
    } as any;

    const event = createEvent('POST', '/api/events/evt-ccl-1/rsvp', {}, {
      authorization: 'Bearer valid.att.token',
    });

    const res = await routeRequest(event, { authService: mockAuthService, rsvpService: mockRsvpService }) as any;
    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'CONFIRMED');
    assert.equal(body.rsvpId, 'rsvp-test-1');
  });

  test('routes DELETE /api/events/{eventId}/rsvp to cancelRsvpHandler', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      verifyToken: () => ({ userId: 'usr-att-1', email: 'att@vesit.edu', role: 'ATTENDEE' as const }),
    } as any;

    const mockRsvpService = {
      cancelRsvp: async (eid: string, _caller: any) => ({
        message: 'Registration successfully cancelled.',
        promotedAttendee: 'Aarav Sharma',
      }),
    } as any;

    const event = createEvent('DELETE', '/api/events/evt-ccl-1/rsvp', undefined, {
      authorization: 'Bearer valid.att.token',
    });

    const res = await routeRequest(event, { authService: mockAuthService, rsvpService: mockRsvpService }) as any;
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.promotedAttendee, 'Aarav Sharma');
  });

  test('routes GET /api/me/rsvps to getMyRsvpsHandler', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockAuthService = {
      verifyToken: () => ({ userId: 'usr-att-1', email: 'att@vesit.edu', role: 'ATTENDEE' as const }),
    } as any;

    const mockRsvpService = {
      getMyRsvps: async () => [
        {
          rsvpId: 'rsvp-1',
          eventId: 'evt-ccl-1',
          status: 'CONFIRMED',
          ticketId: 'tkt-1',
          createdAt: '2026-11-01T10:00:00.000Z',
          event: { title: 'Hackathon', venue: 'VESIT', startAt: '2027-11-15T09:00:00.000Z' },
        },
      ],
    } as any;

    const event = createEvent('GET', '/api/me/rsvps', undefined, {
      authorization: 'Bearer valid.att.token',
    });

    const res = await routeRequest(event, { authService: mockAuthService, rsvpService: mockRsvpService }) as any;
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.rsvps.length, 1);
    assert.equal(body.rsvps[0].rsvpId, 'rsvp-1');
  });

  test('POST /api/events/{eventId}/rsvp returns 401 UNAUTHORIZED when Authorization header is missing', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const event = createEvent('POST', '/api/events/evt-ccl-1/rsvp', {});
    const res = await routeRequest(event) as any;
    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  test('DELETE /api/events/{eventId}/rsvp returns 401 UNAUTHORIZED when Authorization header is missing', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const event = createEvent('DELETE', '/api/events/evt-ccl-1/rsvp');
    const res = await routeRequest(event) as any;
    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  test('GET /api/me/rsvps returns 401 UNAUTHORIZED when Authorization header is missing', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const event = createEvent('GET', '/api/me/rsvps');
    const res = await routeRequest(event) as any;
    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });

  test('returns 404 ROUTE_NOT_FOUND on unrecognized routes', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const event = createEvent('GET', '/api/unknown-endpoint');
    await assert.rejects(
      async () => {
        await routeRequest(event);
      },
      (err: any) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, 'ROUTE_NOT_FOUND');
        return true;
      }
    );
  });

  test('HTTP requests attempting to invoke organizer bootstrap return 404', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const event = createEvent('POST', '/api/bootstrap', {
      action: 'BOOTSTRAP_ORGANIZER',
      email: 'lead@vesit.edu',
      secret: 'configured-secret-16',
    });

    const res = await handler(event) as any;
    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, 'ROUTE_NOT_FOUND');
  });
});
