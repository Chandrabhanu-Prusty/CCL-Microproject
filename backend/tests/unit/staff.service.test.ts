import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { StaffService } from '../../src/services/staff.service.js';
import type { StaffRepository } from '../../src/repositories/staff.repository.js';
import type { EventRepository } from '../../src/repositories/event.repository.js';
import type { UserRepository } from '../../src/repositories/user.repository.js';
import type { EventStaffRecord } from '../../src/types/staff.js';
import type { EventItem } from '../../src/types/event.js';
import type { UserProfile, TokenPayload } from '../../src/types/auth.js';
import { NotFoundError, ForbiddenError, ConflictError, AppError } from '../../src/utils/errors.js';

describe('StaffService Unit Tests', () => {
  const organizerCaller: TokenPayload = {
    userId: 'usr-org-1',
    email: 'organizer@vesit.edu',
    role: 'ORGANIZER',
  };

  const otherOrganizerCaller: TokenPayload = {
    userId: 'usr-org-2',
    email: 'other.org@vesit.edu',
    role: 'ORGANIZER',
  };

  const attendeeCaller: TokenPayload = {
    userId: 'usr-att-1',
    email: 'attendee@vesit.edu',
    role: 'ATTENDEE',
  };

  const sampleEvent: EventItem = {
    eventId: 'evt-ccl-1',
    title: 'Cloud Canvas 2026',
    description: 'Hackathon',
    category: 'Technology',
    startAt: '2026-11-15T09:00:00.000Z',
    venue: 'Auditorium',
    capacity: 100,
    confirmedCount: 88,
    status: 'PUBLISHED',
    organizerId: 'usr-org-1',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  };

  const sampleAttendeeProfile: UserProfile = {
    userId: 'usr-coord-1',
    itemType: 'PROFILE',
    name: 'Preeti Coordinator',
    email: 'preeti.coord@vesit.edu',
    normalizedEmail: 'preeti.coord@vesit.edu',
    passwordHash: 'hashed_password',
    role: 'ATTENDEE',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  };

  const sampleStaffRecord: EventStaffRecord = {
    eventId: 'evt-ccl-1',
    userId: 'usr-coord-1',
    email: 'preeti.coord@vesit.edu',
    name: 'Preeti Coordinator',
    permission: 'CHECK_IN',
    assignedAt: '2026-10-12T10:00:00.000Z',
    assignedBy: 'usr-org-1',
  };

  test('listStaff allows event owner to list staff', async () => {
    const mockStaffRepo = {
      findStaffByEvent: async () => [sampleStaffRecord],
    } as unknown as StaffRepository;

    const mockEventRepo = {
      findById: async () => sampleEvent,
    } as unknown as EventRepository;

    const service = new StaffService(mockStaffRepo, mockEventRepo, {} as any);
    const staff = await service.listStaff('evt-ccl-1', organizerCaller);

    assert.equal(staff.length, 1);
    assert.equal(staff[0].userId, 'usr-coord-1');
  });

  test('listStaff rejects non-organizer callers with 403', async () => {
    const service = new StaffService({} as any, {} as any, {} as any);
    await assert.rejects(
      async () => {
        await service.listStaff('evt-ccl-1', attendeeCaller);
      },
      (err: any) => {
        assert.equal(err instanceof ForbiddenError, true);
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /Requires ORGANIZER role/);
        return true;
      }
    );
  });

  test('listStaff rejects non-owner organizer callers with 403', async () => {
    const mockEventRepo = {
      findById: async () => sampleEvent, // owned by usr-org-1
    } as unknown as EventRepository;

    const service = new StaffService({} as any, mockEventRepo, {} as any);
    await assert.rejects(
      async () => {
        await service.listStaff('evt-ccl-1', otherOrganizerCaller); // usr-org-2
      },
      (err: any) => {
        assert.equal(err instanceof ForbiddenError, true);
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /You do not own this event/);
        return true;
      }
    );
  });

  test('listStaff throws 404 when event does not exist', async () => {
    const mockEventRepo = {
      findById: async () => null,
    } as unknown as EventRepository;

    const service = new StaffService({} as any, mockEventRepo, {} as any);
    await assert.rejects(
      async () => {
        await service.listStaff('evt-nonexistent', organizerCaller);
      },
      (err: any) => {
        assert.equal(err instanceof NotFoundError, true);
        assert.equal(err.code, 'EVENT_NOT_FOUND');
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  test('assignStaff assigns pre-registered user and preserves their global role', async () => {
    let savedRecord: any = null;
    const mockStaffRepo = {
      findStaffMember: async () => null, // Not already assigned
      assignStaff: async (rec: EventStaffRecord) => {
        savedRecord = rec;
        return rec;
      },
    } as unknown as StaffRepository;

    const mockEventRepo = {
      findById: async () => sampleEvent,
    } as unknown as EventRepository;

    const mockUserRepo = {
      findByNormalizedEmail: async (email: string) => {
        if (email === 'preeti.coord@vesit.edu') {
          return sampleAttendeeProfile; // role: ATTENDEE
        }
        return null;
      },
    } as unknown as UserRepository;

    const service = new StaffService(mockStaffRepo, mockEventRepo, mockUserRepo);
    const result = await service.assignStaff('evt-ccl-1', organizerCaller, '  Preeti.Coord@vesit.edu ');

    assert.equal(result.userId, 'usr-coord-1');
    assert.equal(result.permission, 'CHECK_IN');
    assert.equal(result.assignedBy, 'usr-org-1');
    assert.equal(savedRecord?.email, 'preeti.coord@vesit.edu');

    // Global role of user remains ATTENDEE
    assert.equal(sampleAttendeeProfile.role, 'ATTENDEE');
  });

  test('assignStaff rejects unregistered email with 400 USER_NOT_FOUND', async () => {
    const mockEventRepo = {
      findById: async () => sampleEvent,
    } as unknown as EventRepository;

    const mockUserRepo = {
      findByNormalizedEmail: async () => null, // Not registered
    } as unknown as UserRepository;

    const service = new StaffService({} as any, mockEventRepo, mockUserRepo);
    await assert.rejects(
      async () => {
        await service.assignStaff('evt-ccl-1', organizerCaller, 'notfound@vesit.edu');
      },
      (err: any) => {
        assert.equal(err instanceof AppError, true);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'USER_NOT_FOUND');
        assert.match(err.message, /No registered account exists with this email address/);
        return true;
      }
    );
  });

  test('assignStaff rejects duplicate assignment with 409 ALREADY_ASSIGNED', async () => {
    const mockStaffRepo = {
      findStaffMember: async () => sampleStaffRecord, // Already assigned
    } as unknown as StaffRepository;

    const mockEventRepo = {
      findById: async () => sampleEvent,
    } as unknown as EventRepository;

    const mockUserRepo = {
      findByNormalizedEmail: async () => sampleAttendeeProfile,
    } as unknown as UserRepository;

    const service = new StaffService(mockStaffRepo, mockEventRepo, mockUserRepo);
    await assert.rejects(
      async () => {
        await service.assignStaff('evt-ccl-1', organizerCaller, 'preeti.coord@vesit.edu');
      },
      (err: any) => {
        assert.equal(err instanceof ConflictError, true);
        assert.equal(err.code, 'ALREADY_ASSIGNED');
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /already an active coordinator/);
        return true;
      }
    );
  });

  test('revokeStaff allows event owner to revoke assignment', async () => {
    let revoked = false;
    const mockStaffRepo = {
      revokeStaff: async (eid: string, uid: string) => {
        if (eid === 'evt-ccl-1' && uid === 'usr-coord-1') {
          revoked = true;
        }
      },
    } as unknown as StaffRepository;

    const mockEventRepo = {
      findById: async () => sampleEvent,
    } as unknown as EventRepository;

    const service = new StaffService(mockStaffRepo, mockEventRepo, {} as any);
    await service.revokeStaff('evt-ccl-1', organizerCaller, 'usr-coord-1');
    assert.equal(revoked, true);
  });

  test('revokeStaff rejects non-owner organizer callers with 403', async () => {
    const mockEventRepo = {
      findById: async () => sampleEvent,
    } as unknown as EventRepository;

    const service = new StaffService({} as any, mockEventRepo, {} as any);
    await assert.rejects(
      async () => {
        await service.revokeStaff('evt-ccl-1', otherOrganizerCaller, 'usr-coord-1');
      },
      (err: any) => {
        assert.equal(err instanceof ForbiddenError, true);
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /You do not own this event/);
        return true;
      }
    );
  });

  test('listAssignedEvents queries user-assigned-events-index GSI and returns event summaries', async () => {
    const mockStaffRepo = {
      findAssignedEventsByUser: async (uid: string) => {
        if (uid === 'usr-coord-1') {
          return [sampleStaffRecord];
        }
        return [];
      },
    } as unknown as StaffRepository;

    const mockEventRepo = {
      findById: async (id: string) => (id === 'evt-ccl-1' ? sampleEvent : null),
    } as unknown as EventRepository;

    const service = new StaffService(mockStaffRepo, mockEventRepo, {} as any);
    const assigned = await service.listAssignedEvents({
      userId: 'usr-coord-1',
      email: 'preeti.coord@vesit.edu',
      role: 'ATTENDEE',
    });

    assert.equal(assigned.length, 1);
    assert.equal(assigned[0].eventId, 'evt-ccl-1');
    assert.equal(assigned[0].title, 'Cloud Canvas 2026');
    assert.equal(assigned[0].venue, 'Auditorium');
    assert.equal(assigned[0].confirmedCount, 88);
  });
});
