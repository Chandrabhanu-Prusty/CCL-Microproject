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

  test('rsvpEvent successfully reserves confirmed seat and passes ticket metadata', async () => {
    let reservedParams: any = null;
    const mockRsvpRepo = {
      findByEventAndAttendee: async () => null,
      reserveConfirmedSeat: async (eid: string, aid: string, rid: string, ticketData: any) => {
        reservedParams = { eid, aid, rid, ticketData };
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
    assert.equal(reservedParams.ticketData.attendeeName, 'Attendee One');
    assert.equal(reservedParams.ticketData.attendeeEmail, 'attendee@vesit.edu');
    assert.equal(reservedParams.ticketData.eventTitle, 'Cloud Canvas 2026');
    assert.equal(reservedParams.ticketData.eventVenue, 'Auditorium, VESIT');
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
    assert.equal(waitlistParams.name, 'Attendee One');
  });

  test('rsvpEvent allows re-registration when caller previously held CANCELLED status', async () => {
    const cancelledRsvp: RsvpItem = {
      eventId: 'evt-ccl-1',
      attendeeId: 'usr-att-1',
      rsvpId: 'rsvp-old-cancelled',
      status: 'CANCELLED',
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:30:00.000Z',
    };

    let reserveCalled = false;
    const mockRsvpRepo = {
      findByEventAndAttendee: async () => cancelledRsvp,
      reserveConfirmedSeat: async () => {
        reserveCalled = true;
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
    assert.equal(reserveCalled, true);
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

  test('rsvpEvent throws 400 REGISTRATION_CLOSED if transaction fails due to event start time', async () => {
    const mockRsvpRepo = {
      findByEventAndAttendee: async () => null,
      reserveConfirmedSeat: async () => {
        // Condition check failed inside transaction because event started
        return { success: false, reason: 'REGISTRATION_CLOSED' as const };
      },
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
        assert.equal(err instanceof AppError, true);
        assert.equal(err.code, 'REGISTRATION_CLOSED');
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  test('rsvpEvent retries confirmed seat when a seat opens up before waitlist transaction commits', async () => {
    let callCount = 0;
    const mockEventRepo = {
      findById: async () => {
        callCount++;
        if (callCount === 1) {
          return { ...sampleEvent, capacity: 100, confirmedCount: 100 };
        }
        return { ...sampleEvent, capacity: 100, confirmedCount: 99 };
      },
    } as unknown as EventRepository;

    let confirmedSeatAttempted = false;
    const mockRsvpRepo = {
      findByEventAndAttendee: async () => null,
      joinWaitlist: async () => {
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

  test('cancelRsvp for confirmed attendee with empty waitlist updates status and ticket to CANCELLED', async () => {
    const existingRsvp: RsvpItem = {
      eventId: 'evt-ccl-1',
      attendeeId: 'usr-att-1',
      rsvpId: 'rsvp-1',
      status: 'CONFIRMED',
      ticketId: 'tkt-1',
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    };

    let cancelParams: any = null;
    const mockRsvpRepo = {
      findByEventAndAttendee: async () => existingRsvp,
      getOldestWaitlistEntry: async () => null,
      cancelConfirmedWithoutWaitlist: async (eid: string, aid: string, tid?: string) => {
        cancelParams = { eid, aid, tid };
        return { success: true };
      },
    } as unknown as RsvpRepository;

    const service = new RsvpService(mockRsvpRepo);
    const res = await service.cancelRsvp('evt-ccl-1', attendeeCaller);

    assert.equal(cancelParams.eid, 'evt-ccl-1');
    assert.equal(cancelParams.aid, 'usr-att-1');
    assert.equal(cancelParams.tid, 'tkt-1');
    assert.equal(res.promotedAttendee, null);
    assert.match(res.message, /successfully cancelled/);
  });

  test('cancelRsvp for confirmed attendee with waitlist promotes oldest candidate and passes ticket details', async () => {
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

    let promoParams: any = null;
    const mockRsvpRepo = {
      findByEventAndAttendee: async () => existingRsvp,
      getOldestWaitlistEntry: async () => oldestWaitlistCandidate,
      promoteWaitlistEntry: async (
        eid: string,
        cid: string,
        oldTid: string | undefined,
        cand: WaitlistItem,
        newTid: string,
        evtDetails?: any
      ) => {
        promoParams = { eid, cid, oldTid, cand, newTid, evtDetails };
        return { success: true };
      },
    } as unknown as RsvpRepository;

    const mockEventRepo = {
      findById: async () => sampleEvent,
    } as unknown as EventRepository;

    const service = new RsvpService(mockRsvpRepo, mockEventRepo);
    const res = await service.cancelRsvp('evt-ccl-1', attendeeCaller);

    assert.equal(promoParams.cid, 'usr-att-1');
    assert.equal(promoParams.oldTid, 'tkt-1');
    assert.equal(promoParams.cand.attendeeId, 'usr-waitlist-first');
    assert.equal(promoParams.evtDetails.eventTitle, 'Cloud Canvas 2026');
    assert.equal(res.promotedAttendee, 'Aarav Sharma');
  });

  test('cancelRsvp privacy: does not leak promoted attendee email when name is missing', async () => {
    const existingRsvp: RsvpItem = {
      eventId: 'evt-ccl-1',
      attendeeId: 'usr-att-1',
      rsvpId: 'rsvp-1',
      status: 'CONFIRMED',
      ticketId: 'tkt-1',
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    };

    const namelessWaitlistCandidate: WaitlistItem = {
      eventId: 'evt-ccl-1',
      queueKey: '2026-11-01T10:05:00.000Z#usr-waitlist-first',
      attendeeId: 'usr-waitlist-first',
      attendeeName: '', // empty name!
      attendeeEmail: 'private_email@vesit.edu',
      status: 'WAITING',
      createdAt: '2026-11-01T10:05:00.000Z',
    };

    const mockRsvpRepo = {
      findByEventAndAttendee: async () => existingRsvp,
      getOldestWaitlistEntry: async () => namelessWaitlistCandidate,
      promoteWaitlistEntry: async () => ({ success: true }),
    } as unknown as RsvpRepository;

    const service = new RsvpService(mockRsvpRepo);
    const res = await service.cancelRsvp('evt-ccl-1', attendeeCaller);

    // Must return generic 'Waitlisted Attendee', NOT private_email@vesit.edu!
    assert.equal(res.promotedAttendee, 'Waitlisted Attendee');
    assert.notEqual(res.promotedAttendee, 'private_email@vesit.edu');
  });

  test('cancelRsvp handles race condition when waitlisted attendee is promoted during cancellation', async () => {
    // Initial read shows waitlisted RSVP
    const waitlistedRsvp: RsvpItem = {
      eventId: 'evt-ccl-1',
      attendeeId: 'usr-att-1',
      rsvpId: 'rsvp-wl-1',
      status: 'WAITLISTED',
      queueKey: '2026-11-01T11:00:00.000Z#usr-att-1',
      createdAt: '2026-11-01T11:00:00.000Z',
      updatedAt: '2026-11-01T11:00:00.000Z',
    };

    // Strongly consistent read after race shows user was promoted to CONFIRMED!
    const promotedConfirmedRsvp: RsvpItem = {
      eventId: 'evt-ccl-1',
      attendeeId: 'usr-att-1',
      rsvpId: 'rsvp-wl-1',
      status: 'CONFIRMED',
      ticketId: 'tkt-promoted-to-user',
      createdAt: '2026-11-01T11:00:00.000Z',
      updatedAt: '2026-11-01T11:05:00.000Z',
    };

    let findCount = 0;
    let confirmedCancelCalled = false;

    const mockRsvpRepo = {
      findByEventAndAttendee: async () => {
        findCount++;
        if (findCount === 1) return waitlistedRsvp;
        return promotedConfirmedRsvp;
      },
      cancelWaitlistedRsvp: async () => {
        // Fails because attendee is no longer WAITLISTED (was promoted concurrently)
        return { success: false, reason: 'CONCURRENT_WAITLIST_CONFLICT' as const };
      },
      getOldestWaitlistEntry: async () => null, // empty waitlist
      cancelConfirmedWithoutWaitlist: async () => {
        confirmedCancelCalled = true;
        return { success: true };
      },
    } as unknown as RsvpRepository;

    const service = new RsvpService(mockRsvpRepo);
    const res = await service.cancelRsvp('evt-ccl-1', attendeeCaller);

    assert.equal(confirmedCancelCalled, true);
    assert.match(res.message, /successfully cancelled/);
    assert.equal(res.promotedAttendee, null);
  });

  test('cancelRsvp throws 404 RSVP_NOT_FOUND when caller has no active registration or only CANCELLED', async () => {
    const cancelledRsvp: RsvpItem = {
      eventId: 'evt-ccl-1',
      attendeeId: 'usr-att-1',
      rsvpId: 'rsvp-cancelled',
      status: 'CANCELLED',
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:30:00.000Z',
    };

    const mockRsvpRepo = {
      findByEventAndAttendee: async () => cancelledRsvp,
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

  test('getMyRsvps excludes CANCELLED registrations and enriches active items with event details', async () => {
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
      {
        eventId: 'evt-ccl-2',
        attendeeId: 'usr-att-1',
        rsvpId: 'rsvp-cancelled-old',
        status: 'CANCELLED',
        createdAt: '2026-10-15T10:00:00.000Z',
        updatedAt: '2026-10-16T10:00:00.000Z',
      },
    ];

    const mockRsvpRepo = {
      findRsvpsByAttendee: async () => mockRsvps,
    } as unknown as RsvpRepository;

    const mockEventRepo = {
      findById: async (id: string) => (id === 'evt-ccl-1' ? sampleEvent : null),
    } as unknown as EventRepository;

    const service = new RsvpService(mockRsvpRepo, mockEventRepo);
    const rsvps = await service.getMyRsvps(attendeeCaller);

    // Cancelled RSVP must be excluded
    assert.equal(rsvps.length, 1);
    assert.equal(rsvps[0].rsvpId, 'rsvp-1');
    assert.equal(rsvps[0].status, 'CONFIRMED');
    assert.equal(rsvps[0].ticketId, 'tkt-1');
    assert.equal(rsvps[0].event.title, 'Cloud Canvas 2026');
  });
});
