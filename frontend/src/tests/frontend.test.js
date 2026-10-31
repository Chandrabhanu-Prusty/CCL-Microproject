import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mockBackend } from '../services/mockData.js';
import { getAuthHeaders } from '../auth/authHelpers.js';
import { apiRequest, getApiConfig } from '../services/apiClient.js';

describe('Auth Helpers & Token Management', () => {
  test('getAuthHeaders generates correct Content-Type and Bearer token', () => {
    const headers = getAuthHeaders();
    assert.equal(headers['Content-Type'], 'application/json');
  });
});

describe('API Contract & Mock Backend Verification', () => {
  test('getEvents returns published events list', async () => {
    const res = await mockBackend.getEvents();
    assert.ok(Array.isArray(res.events));
    assert.ok(res.events.length > 0);
    const evt = res.events[0];
    assert.ok(evt.eventId);
    assert.ok(evt.title);
    assert.ok(evt.capacity > 0);
  });

  test('Filter events by search query and category', async () => {
    const res = await mockBackend.getEvents({ q: 'hackathon', category: 'Technology' });
    assert.ok(res.events.length > 0);
    assert.equal(res.events[0].category, 'Technology');
  });

  test('RSVP on available event creates CONFIRMED status and opaque ticket ID', async () => {
    const testUser = {
      userId: `usr-test-${Date.now()}`,
      name: 'Test Attendee',
      email: 'test.attendee@example.com',
      role: 'ATTENDEE',
    };
    const res = await mockBackend.rsvpEvent('evt-react-vite-masterclass', testUser);
    assert.equal(res.status, 'CONFIRMED');
    assert.ok(res.ticketId);
    assert.ok(res.ticketId.startsWith('tkt-'));
  });

  test('RSVP on full event creates WAITLISTED status with queue position', async () => {
    const testUser = {
      userId: `usr-waitlist-${Date.now()}`,
      name: 'Waitlist Attendee',
      email: 'waitlist@example.com',
      role: 'ATTENDEE',
    };
    // evt-gdg-devfest is already at 50/50 capacity in mockData
    const res = await mockBackend.rsvpEvent('evt-gdg-devfest', testUser);
    assert.equal(res.status, 'WAITLISTED');
    assert.ok(res.queuePosition >= 1);
  });

  test('Single-use check-in enforces ACTIVE ticket and blocks duplicate check-in', async () => {
    // Preeti Coordinator has global role ATTENDEE and explicit CHECK_IN assignment in mockEventStaff
    const assignedStaff = {
      userId: 'usr-coordinator-01',
      name: 'Preeti Coordinator',
      role: 'ATTENDEE',
    };

    // Check in Aarav Sharma (tkt-sample-coordinator-lookup) for evt-ccl-hackathon-2026
    const checkInRes = await mockBackend.checkInTicket(
      'evt-ccl-hackathon-2026',
      'tkt-sample-coordinator-lookup',
      assignedStaff
    );
    assert.equal(checkInRes.status, 'CHECKED_IN');
    assert.ok(checkInRes.checkedInAt);

    // Attempt duplicate check-in -> must reject with ALREADY_CHECKED_IN
    await assert.rejects(
      async () => {
        await mockBackend.checkInTicket(
          'evt-ccl-hackathon-2026',
          'tkt-sample-coordinator-lookup',
          assignedStaff
        );
      },
      (err) => {
        return err.error?.code === 'ALREADY_CHECKED_IN';
      }
    );
  });

  test('Ticket QR payload contains strictly opaque ticket ID', async () => {
    const res = await mockBackend.getTicketById('tkt-8f3a9e1b2c4d', { userId: 'usr-attendee-demo', role: 'ATTENDEE' });
    assert.ok(res.ticket);
    // Ticket ID must be an opaque string without embedded passwords or tokens
    assert.equal(typeof res.ticket.ticketId, 'string');
    assert.ok(!res.ticket.ticketId.includes('Bearer'));
    assert.ok(!res.ticket.ticketId.includes('jwt'));
  });
});

describe('Role-Based Access Control (RBAC) & Event Staff Scoping', () => {
  const unassignedAttendee = {
    userId: 'usr-attendee-demo',
    email: 'chandrabhanu@example.com',
    name: 'Chandrabhanu Prusty',
    role: 'ATTENDEE',
  };

  const organizerOwner = {
    userId: 'usr-organizer-01',
    email: 'organizer.neilsen@example.com',
    name: 'Neilsen Organizer',
    role: 'ORGANIZER',
  };

  const organizerOther = {
    userId: 'usr-organizer-02',
    email: 'organizer.council@example.com',
    name: 'Council Lead',
    role: 'ORGANIZER',
  };

  // Assigned staff has global role ATTENDEE and is present in mockEventStaff
  const assignedCoordinator = {
    userId: 'usr-coordinator-01',
    email: 'coordinator.preeti@example.com',
    name: 'Preeti Coordinator',
    role: 'ATTENDEE',
  };

  // Unassigned attendee has global role ATTENDEE and is NOT in mockEventStaff
  const unassignedCoordinator = {
    userId: 'usr-coordinator-02',
    email: 'coordinator.samir@example.com',
    name: 'Samir Coordinator',
    role: 'ATTENDEE',
  };

  test('Unassigned attendee is strictly forbidden from checking in tickets', async () => {
    await assert.rejects(
      async () => {
        await mockBackend.checkInTicket(
          'evt-ccl-hackathon-2026',
          'tkt-8f3a9e1b2c4d',
          unassignedAttendee
        );
      },
      (err) => {
        return err.status === 403 && err.error?.code === 'FORBIDDEN';
      }
    );
  });

  test('Organizer without explicit staff assignment cannot check in tickets', async () => {
    // organizerOwner owns the event, but has not assigned themselves to mockEventStaff
    await assert.rejects(
      async () => {
        await mockBackend.checkInTicket(
          'evt-ccl-hackathon-2026',
          'tkt-8f3a9e1b2c4d',
          organizerOwner
        );
      },
      (err) => {
        return err.status === 403 && err.error?.code === 'FORBIDDEN';
      }
    );
  });

  test('Unassigned attendee is forbidden from viewing attendee list', async () => {
    await assert.rejects(
      async () => {
        await mockBackend.getAttendees('evt-ccl-hackathon-2026', 'test', unassignedAttendee);
      },
      (err) => {
        return err.status === 403 && err.error?.code === 'FORBIDDEN';
      }
    );
  });

  test('Assigned attendee coordinator can check in attendees for assigned event', async () => {
    // Preeti is assigned to evt-ccl-hackathon-2026
    const res = await mockBackend.checkInTicket(
      'evt-ccl-hackathon-2026',
      'tkt-8f3a9e1b2c4d',
      assignedCoordinator
    );
    assert.equal(res.status, 'CHECKED_IN');
  });

  test('Unassigned attendee is rejected from check-in on unassigned event', async () => {
    // unassignedCoordinator is NOT in mockEventStaff for evt-ccl-hackathon-2026
    await assert.rejects(
      async () => {
        await mockBackend.checkInTicket(
          'evt-ccl-hackathon-2026',
          'tkt-8f3a9e1b2c4d',
          unassignedCoordinator
        );
      },
      (err) => {
        return err.status === 403 && err.error?.code === 'FORBIDDEN';
      }
    );
  });

  test('Assigned staff attendee search requires min 2 chars and returns masked emails', async () => {
    // Missing query (<2 chars) fails for staff
    await assert.rejects(
      async () => {
        await mockBackend.getAttendees('evt-ccl-hackathon-2026', '', assignedCoordinator);
      },
      (err) => {
        return err.status === 400 && err.error?.code === 'QUERY_REQUIRED';
      }
    );

    // Query with 2 chars succeeds and masks attendee email
    const res = await mockBackend.getAttendees('evt-ccl-hackathon-2026', 'aarav', assignedCoordinator);
    assert.ok(res.attendees.length > 0);
    assert.ok(res.attendees[0].attendeeEmail.includes('***'));
  });

  test('Organizer can assign and revoke coordinator check-in staff', async () => {
    // Assign Samir Coordinator to evt-ccl-hackathon-2026
    const assignRes = await mockBackend.assignCoordinator(
      'evt-ccl-hackathon-2026',
      'coordinator.samir@example.com',
      organizerOwner
    );
    assert.ok(assignRes.assignment);
    assert.equal(assignRes.assignment.email, 'coordinator.samir@example.com');
    assert.equal(assignRes.assignment.permission, 'CHECK_IN');

    // Verify staff list includes Samir
    const staffRes = await mockBackend.getEventStaff('evt-ccl-hackathon-2026', organizerOwner);
    assert.ok(staffRes.staff.some(s => s.email === 'coordinator.samir@example.com'));

    // Revoke coordinator
    const removeRes = await mockBackend.removeCoordinator(
      'evt-ccl-hackathon-2026',
      assignRes.assignment.userId,
      organizerOwner
    );
    assert.ok(removeRes.message);

    // Verify removed
    const afterRes = await mockBackend.getEventStaff('evt-ccl-hackathon-2026', organizerOwner);
    assert.ok(!afterRes.staff.some(s => s.userId === assignRes.assignment.userId));
  });

  test('Organizer cannot edit or assign staff to events owned by other organizers', async () => {
    // organizerOther does not own evt-ccl-hackathon-2026
    await assert.rejects(
      async () => {
        await mockBackend.assignCoordinator(
          'evt-ccl-hackathon-2026',
          'coordinator.preeti@example.com',
          organizerOther
        );
      },
      (err) => {
        return err.status === 403 && err.error?.code === 'FORBIDDEN';
      }
    );
  });
});

describe('API Client & Explicit Mock Mode Enforcements', () => {
  test('apiRequest throws CONFIG_ERROR when neither base URL nor mock mode is configured', async () => {
    delete process.env.VITE_API_BASE_URL;
    delete process.env.VITE_USE_MOCK_API;
    const config = getApiConfig();
    assert.equal(config.isMockMode, false);
    assert.equal(config.baseUrl, '');
    await assert.rejects(
      async () => {
        await apiRequest('/api/events');
      },
      (err) => {
        return err.code === 'CONFIG_ERROR' && err.message.includes('API base URL is not configured');
      }
    );
  });

  test('apiRequest executes mock request when VITE_USE_MOCK_API is explicitly true', async () => {
    delete process.env.VITE_API_BASE_URL;
    process.env.VITE_USE_MOCK_API = 'true';
    const config = getApiConfig();
    assert.equal(config.isMockMode, true);
    const res = await apiRequest('/api/events');
    assert.ok(Array.isArray(res.events));
    assert.ok(res.events.length > 0);
  });

  test('apiRequest throws NETWORK_ERROR and never falls back to mock data when backend is unreachable', async () => {
    process.env.VITE_API_BASE_URL = 'http://127.0.0.1:59999';
    process.env.VITE_USE_MOCK_API = 'true'; // even if set to true, real URL takes precedence
    const config = getApiConfig();
    assert.equal(config.isMockMode, false);
    await assert.rejects(
      async () => {
        await apiRequest('/api/events');
      },
      (err) => {
        return err.code === 'NETWORK_ERROR' && err.message.includes('Unable to reach the Marque backend');
      }
    );
    // Cleanup env
    delete process.env.VITE_API_BASE_URL;
    delete process.env.VITE_USE_MOCK_API;
  });
});

describe('Stakeholder Registration & Auth Guardrails', () => {
  test('public registration endpoint returns ATTENDEE role by default', async () => {
    process.env.VITE_USE_MOCK_API = 'true';
    delete process.env.VITE_API_BASE_URL;
    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'New Campus Member',
        email: 'new.member@campus.edu',
        password: 'SecurePassword123!',
      }),
    });
    assert.ok(res.token);
    assert.ok(res.user);
    assert.equal(res.user.role, 'ATTENDEE');
    delete process.env.VITE_USE_MOCK_API;
  });

  test('public registration ignores any privileged role passed in body', async () => {
    process.env.VITE_USE_MOCK_API = 'true';
    delete process.env.VITE_API_BASE_URL;
    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Attacker Attempting Privileges',
        email: 'attacker@campus.edu',
        password: 'SecurePassword123!',
        role: 'ORGANIZER', // Client trying to elevate privileges
      }),
    });
    assert.equal(res.user.role, 'ATTENDEE');
    delete process.env.VITE_USE_MOCK_API;
  });
});
