import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RsvpService } from '../../src/services/rsvp.service.js';
import type { RsvpRepository } from '../../src/repositories/rsvp.repository.js';
import type { EventRepository } from '../../src/repositories/event.repository.js';
import type { UserRepository } from '../../src/repositories/user.repository.js';
import type { EventItem } from '../../src/types/event.js';
import type { RsvpItem, WaitlistItem } from '../../src/types/rsvp.js';
import { NotFoundError, ConflictError, AppError } from '../../src/utils/errors.js';

describe('RsvpService Unit Tests', () => {
  const sampleEvent: EventItem = {
    eventId: 'evt-ccl-1',
    title: 'Cloud Canvas 2026',
    description: 'Premier hackathon',
    category: 'Technology',
    startAt: '2027-11-15T09:00:00.000Z',
    endAt: '2027-11-17T17:00:00.000Z',
    venue: 'Auditorium, VESIT',
    capacity: 100,
    confirmedCount: 50,
    waitlistCount: 0,
    status: 'PUBLISHED',
    organizerId: 'usr-org-1',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  };

  const attendeeCaller = {
    userId: 'usr-att-1',
    email: 'attendee@vesit.edu',
    role: 'ATTENDEE' as const,
  };

  test('rsvpEvent successfully reserves confirmed seat when capacity is available', async () => {
    let reservedParams: any = null;
    const mockRsvpRepo = {
      findByEventAndAttendee: async () => null,
      reserveConfirmedSeat: async (eid: string, aid: string, rid: string, tid: string) => {
        reservedParams = { eid, aid, rid, tid };
        return { success: true };
      },
    } as unknown as RsvpRepository;

    const mockEventRepo = {
      findById: async () => sampleEvent,
    } as unknown as EventRepository;

    const mockUserRepo = {
      findById: async () => ({ userId: 'usr-att-1', name: 'Attendee One' }),
    } as unknown as UserRepository;

    const service = new RsvpService(mockRsvpRepo, mockEventRepo, mockUserRepo);
    const res = await service.rsvpEvent('evt-ccl-1', attendeeCaller);

    assert.equal(res.status, 'CONFIRMED');
    assert.match(res.rsvpId, /^rsvp-/);
    assert.match((res as any).ticketId, /^tkt-/);
    assert.equal(reservedParams.eid, 'evt-ccl-1');
    assert.equal(reservedParams.aid, 'usr-att-1');
  });

  test('rsvpEvent successfully joins waitlist when event is full (confirmedCount >= capacity)', async () => {
    const fullEvent: EventItem = {
      ...sampleEvent,
      capacity: 100,
      confirmedCount: 100,
      waitlistCount: 2,
    };

    let waitlistParams: any = null;
    const mockRsvpRepo = {
      findByEventAndAttendee: async () => null,
      joinWaitlist: async (eid: string, aid: string, rid: string, qk: string, name: string, email: string) => {
        waitlistParams = { eid, aid, rid, qk, name, email };
        return { success: true };
      },
      getWaitlistCount: async () => 3,
    } as unknown as RsvpRepository;

    const mockEventRepo = {
      findById: async () => fullEvent,
    } as unknown as EventRepository;

    const mockUserRepo = {
      findById: async () => ({ userId: 'usr-att-1', name: 'Attendee One' }),
    } as unknown as UserRepository;

    const service = new RsvpService(mockRsvpRepo, mockEventRepo, mockUserRepo);
    const res = await service.rsvpEvent('evt-ccl-1', attendeeCaller);

    assert.equal(res.status, 'WAITLISTED');
    assert.match(res.rsvpId, /^rsvp-/);
    assert.equal((res as any).queuePosition, 3);
    assert.match((res as any).queueKey, /#usr-att-1$/);
    assert.equal(waitlistParams.email, 'attendee@vesit.edu');
  });

  test('rsvpEvent rejects duplicate registration if caller already holds CONFIRMED RSVP', async () => {
    const mockRsvpRepo = {
      findByEventAndAttendee: async () => ({
        eventId: 'evt-ccl-1',
        attendeeId: 'usr-att-1',
        rsvpId: 'rsvp-existing',
        status: 'CONFIRMED' as const,
        createdAt: '2026-11-01T10:00:00.000Z',
        updatedAt: '2026-11-01T10:00:00.000Z',
      }),
    } as unknown as RsvpRepository;

    const mockEventRepo = {
      findById: async () => sampleEvent,
    } as unknown as EventRepository;

    const service = new RsvpService(mockRsvpRepo, mockEventRepo);
    await assert.rejects(
      async () => {
        await service.rsvpEvent('evt-ccl-1', attendeeCaller);
      },
      (err: any) => {
        assert.equal(err instanceof ConflictError, true);
        assert.equal(err.code, 'DUPLICATE_REGISTRATION');
        assert.equal(err.statusCode, 409);
        return true;
      }
    );
  });

  test('rsvpEvent rejects duplicate registration if caller already holds WAITLISTED RSVP', async () => {
    const mockRsvpRepo = {
      findByEventAndAttendee: async () => ({
        eventId: 'evt-ccl-1',
        attendeeId: 'usr-att-1',
        rsvpId: 'rsvp-waitlisted',
        status: 'WAITLISTED' as const,
        createdAt: '2026-11-01T10:00:00.000Z',
        updatedAt: '2026-11-01T10:00:00.000Z',
      }),
    } as unknown as RsvpRepository;

    const mockEventRepo = {
      findById: async () => sampleEvent,
    } as unknown as EventRepository;

    const service = new RsvpService(mockRsvpRepo, mockEventRepo);
    await assert.rejects(
      async () => {
        await service.rsvpEvent('evt-ccl-1', attendeeCaller);
      },
      (err: any) => {
        assert.equal(err instanceof ConflictError, true);
        assert.equal(err.code, 'DUPLICATE_REGISTRATION');
        return true;
      }
    );
  });

  test('rsvpEvent retries confirmed seat when a seat opens up before waitlist transaction commits', async () => {
    // Initial read shows full event (100/100)
    let callCount = 0;
    const mockEventRepo = {
      findById: async () => {
        callCount++;
        if (callCount === 1) {
          return { ...sampleEvent, capacity: 100, confirmedCount: 100 };
        }
        // Second read after SEAT_AVAILABLE shows seat freed (99/100)!
        return { ...sampleEvent, capacity: 100, confirmedCount: 99 };
      },
    } as unknown as EventRepository;

    let confirmedSeatAttempted = false;
    const mockRsvpRepo = {
      findByEventAndAttendee: async () => null,
      joinWaitlist: async () => {
        // Fails because seat was freed concurrently
        return { success: false, reason: 'SEAT_AVAILABLE' as const };
      },
      reserveConfirmedSeat: async () => {
        confirmedSeatAttempted = true;
        return { success: true };
      },
    } as unknown as RsvpRepository;

    const service = new RsvpService(mockRsvpRepo, mockEventRepo);
    const res = await service.rsvpEvent('evt-ccl-1', attendeeCaller);

    assert.equal(res.status, 'CONFIRMED');
    assert.equal(confirmedSeatAttempted, true);
  });

  test('rsvpEvent rejects non-existent event with 404 EVENT_NOT_FOUND', async () => {
    const mockEventRepo = {
      findById: async () => null,
    } as unknown as EventRepository;

    const service = new RsvpService({} as any, mockEventRepo);
    await assert.rejects(
      async () => {
        await service.rsvpEvent('evt-nonexistent', attendeeCaller);
      },
      (err: any) => {
        assert.equal(err instanceof NotFoundError, true);
        assert.equal(err.code, 'EVENT_NOT_FOUND');
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  test('rsvpEvent rejects unpublished event with 400 EVENT_NOT_PUBLISHED', async () => {
    const mockEventRepo = {
      findById: async () => ({ ...sampleEvent, status: 'DRAFT' as const }),
    } as unknown as EventRepository;

    const service = new RsvpService({} as any, mockEventRepo);
    await assert.rejects(
      async () => {
        await service.rsvpEvent('evt-ccl-1', attendeeCaller);
      },
      (err: any) => {
        assert.equal(err instanceof AppError, true);
        assert.equal(err.code, 'EVENT_NOT_PUBLISHED');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  test('rsvpEvent rejects past event with 400 REGISTRATION_CLOSED', async () => {
    const mockEventRepo = {
      findById: async () => ({ ...sampleEvent, startAt: '2020-01-01T10:00:00.000Z' }),
    } as unknown as EventRepository;

    const service = new RsvpService({} as any, mockEventRepo);
    await assert.rejects(
      async () => {
        await service.rsvpEvent('evt-ccl-1', attendeeCaller);
      },
      (err: any) => {
        assert.equal(err instanceof AppError, true);
        assert.equal(err.code, 'REGISTRATION_CLOSED');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  test('cancelRsvp for confirmed attendee with empty waitlist decrements confirmedCount', async () => {
    const existingRsvp: RsvpItem = {
      eventId: 'evt-ccl-1',
      attendeeId: 'usr-att-1',
      rsvpId: 'rsvp-1',
      status: 'CONFIRMED',
      ticketId: 'tkt-1',
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    };

    let cancelWithoutWlCalled = false;
    const mockRsvpRepo = {
      findByEventAndAttendee: async () => existingRsvp,
      getOldestWaitlistEntry: async () => null, // empty waitlist
      cancelConfirmedWithoutWaitlist: async (eid: string, aid: string) => {
        cancelWithoutWlCalled = true;
        assert.equal(eid, 'evt-ccl-1');
        assert.equal(aid, 'usr-att-1');
        return { success: true };
      },
    } as unknown as RsvpRepository;

    const service = new RsvpService(mockRsvpRepo);
    const res = await service.cancelRsvp('evt-ccl-1', attendeeCaller);

    assert.equal(cancelWithoutWlCalled, true);
    assert.equal(res.promotedAttendee, null);
    assert.match(res.message, /successfully cancelled/);
  });

  test('cancelRsvp for confirmed attendee with waitlist promotes oldest candidate', async () => {
    const existingRsvp: RsvpItem = {
      eventId: 'evt-ccl-1',
      attendeeId: 'usr-att-1',
      rsvpId: 'rsvp-1',
      status: 'CONFIRMED',
      ticketId: 'tkt-1',
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    };

    const oldestWaitlistCandidate: WaitlistItem = {
      eventId: 'evt-ccl-1',
      queueKey: '2026-11-01T10:05:00.000Z#usr-waitlist-first',
      attendeeId: 'usr-waitlist-first',
      attendeeName: 'Aarav Sharma',
      attendeeEmail: 'aarav@vesit.edu',
      status: 'WAITING',
      createdAt: '2026-11-01T10:05:00.000Z',
    };

    let promoCandidateId = '';
    const mockRsvpRepo = {
      findByEventAndAttendee: async () => existingRsvp,
      getOldestWaitlistEntry: async () => oldestWaitlistCandidate,
      promoteWaitlistEntry: async (_eid: string, _cid: string, cand: WaitlistItem) => {
        promoCandidateId = cand.attendeeId;
        return { success: true };
      },
    } as unknown as RsvpRepository;

    const service = new RsvpService(mockRsvpRepo);
    const res = await service.cancelRsvp('evt-ccl-1', attendeeCaller);

    assert.equal(promoCandidateId, 'usr-waitlist-first');
    assert.equal(res.promotedAttendee, 'Aarav Sharma');
  });

  test('cancelRsvp retries promotion when concurrent waitlist insertion prevented no-waitlist branch', async () => {
    const existingRsvp: RsvpItem = {
      eventId: 'evt-ccl-1',
      attendeeId: 'usr-att-1',
      rsvpId: 'rsvp-1',
      status: 'CONFIRMED',
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    };

    let attempt = 0;
    const promotedCandidate: WaitlistItem = {
      eventId: 'evt-ccl-1',
      queueKey: '2026-11-01T10:10:00.000Z#usr-new-waitlist',
      attendeeId: 'usr-new-waitlist',
      attendeeName: 'New Waitlisted User',
      attendeeEmail: 'new@vesit.edu',
      status: 'WAITING',
      createdAt: '2026-11-01T10:10:00.000Z',
    };

    const mockRsvpRepo = {
      findByEventAndAttendee: async () => existingRsvp,
      getOldestWaitlistEntry: async () => {
        attempt++;
        if (attempt === 1) return null; // First check saw empty waitlist
        return promotedCandidate; // Second check after WAITLIST_NOT_EMPTY sees the newly inserted candidate
      },
      cancelConfirmedWithoutWaitlist: async () => {
        return { success: false, reason: 'WAITLIST_NOT_EMPTY' as const };
      },
      promoteWaitlistEntry: async () => {
        return { success: true };
      },
    } as unknown as RsvpRepository;

    const service = new RsvpService(mockRsvpRepo);
    const res = await service.cancelRsvp('evt-ccl-1', attendeeCaller);

    assert.equal(res.promotedAttendee, 'New Waitlisted User');
  });

  test('cancelRsvp for waitlisted attendee removes both RSVP state and waitlist queue entry', async () => {
    const waitlistedRsvp: RsvpItem = {
      eventId: 'evt-ccl-1',
      attendeeId: 'usr-att-1',
      rsvpId: 'rsvp-wl-1',
      status: 'WAITLISTED',
      queueKey: '2026-11-01T11:00:00.000Z#usr-att-1',
      createdAt: '2026-11-01T11:00:00.000Z',
      updatedAt: '2026-11-01T11:00:00.000Z',
    };

    let cancelledQueueKey = '';
    const mockRsvpRepo = {
      findByEventAndAttendee: async () => waitlistedRsvp,
      cancelWaitlistedRsvp: async (_eid: string, _aid: string, qk: string) => {
        cancelledQueueKey = qk;
        return { success: true };
      },
    } as unknown as RsvpRepository;

    const service = new RsvpService(mockRsvpRepo);
    const res = await service.cancelRsvp('evt-ccl-1', attendeeCaller);

    assert.equal(cancelledQueueKey, '2026-11-01T11:00:00.000Z#usr-att-1');
    assert.equal(res.promotedAttendee, null);
  });

  test('cancelRsvp throws 404 RSVP_NOT_FOUND when caller has no active registration', async () => {
    const mockRsvpRepo = {
      findByEventAndAttendee: async () => null,
    } as unknown as RsvpRepository;

    const service = new RsvpService(mockRsvpRepo);
    await assert.rejects(
      async () => {
        await service.cancelRsvp('evt-ccl-1', attendeeCaller);
      },
      (err: any) => {
        assert.equal(err instanceof NotFoundError, true);
        assert.equal(err.code, 'RSVP_NOT_FOUND');
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  test('getMyRsvps returns caller registrations enriched with event details', async () => {
    const mockRsvps: RsvpItem[] = [
      {
        eventId: 'evt-ccl-1',
        attendeeId: 'usr-att-1',
        rsvpId: 'rsvp-1',
        status: 'CONFIRMED',
        ticketId: 'tkt-1',
        createdAt: '2026-11-01T10:00:00.000Z',
        updatedAt: '2026-11-01T10:00:00.000Z',
      },
    ];

    const mockRsvpRepo = {
      findRsvpsByAttendee: async (aid: string) => {
        assert.equal(aid, 'usr-att-1');
        return mockRsvps;
      },
    } as unknown as RsvpRepository;

    const mockEventRepo = {
      findById: async (id: string) => (id === 'evt-ccl-1' ? sampleEvent : null),
    } as unknown as EventRepository;

    const service = new RsvpService(mockRsvpRepo, mockEventRepo);
    const rsvps = await service.getMyRsvps(attendeeCaller);

    assert.equal(rsvps.length, 1);
    assert.equal(rsvps[0].rsvpId, 'rsvp-1');
    assert.equal(rsvps[0].status, 'CONFIRMED');
    assert.equal(rsvps[0].ticketId, 'tkt-1');
    assert.equal(rsvps[0].event.title, 'Cloud Canvas 2026');
    assert.equal(rsvps[0].event.venue, 'Auditorium, VESIT');
  });
});
