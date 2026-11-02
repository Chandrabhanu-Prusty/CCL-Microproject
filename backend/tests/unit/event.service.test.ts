import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EventService } from '../../src/services/event.service.js';
import type { EventRepository } from '../../src/repositories/event.repository.js';
import type { EventItem } from '../../src/types/event.js';
import { NotFoundError, ForbiddenError, AppError } from '../../src/utils/errors.js';

describe('EventService Unit Tests', () => {
  const sampleEvents: EventItem[] = [
    {
      eventId: 'evt-1',
      title: 'Cloud Canvas 2026',
      description: 'Hackathon',
      category: 'Technology',
      startAt: '2026-11-15T09:00:00.000Z',
      endAt: '2026-11-16T18:00:00.000Z',
      venue: 'Auditorium, VESIT',
      capacity: 100,
      confirmedCount: 88,
      status: 'PUBLISHED',
      organizerId: 'usr-org-1',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    },
    {
      eventId: 'evt-2',
      title: 'React & AWS Workshop',
      description: 'Workshop',
      category: 'Workshop',
      startAt: '2026-11-20T10:00:00.000Z',
      venue: 'Lab 502, VESIT',
      capacity: 40,
      confirmedCount: 10,
      status: 'PUBLISHED',
      organizerId: 'usr-org-2',
      createdAt: '2026-10-05T10:00:00.000Z',
      updatedAt: '2026-10-05T10:00:00.000Z',
    },
  ];

  test('listEvents filters by category and search term q', async () => {
    const mockRepo = {
      findPublished: async (category?: string) => {
        if (category) {
          return sampleEvents.filter((e) => e.category === category);
        }
        return sampleEvents;
      },
    } as unknown as EventRepository;

    const service = new EventService(mockRepo);

    // No filters
    const all = await service.listEvents();
    assert.equal(all.length, 2);

    // Filter by category
    const workshops = await service.listEvents({ category: 'Workshop' });
    assert.equal(workshops.length, 1);
    assert.equal(workshops[0].eventId, 'evt-2');

    // Filter by search query matching title
    const searchCanvas = await service.listEvents({ q: 'canvas' });
    assert.equal(searchCanvas.length, 1);
    assert.equal(searchCanvas[0].eventId, 'evt-1');

    // Filter by search query matching venue
    const searchLab = await service.listEvents({ q: 'lab 502' });
    assert.equal(searchLab.length, 1);
    assert.equal(searchLab[0].eventId, 'evt-2');
  });

  test('getEventById returns event when exists, throws 404 when not found', async () => {
    const mockRepo = {
      findById: async (id: string) => (id === 'evt-1' ? sampleEvents[0] : null),
    } as unknown as EventRepository;

    const service = new EventService(mockRepo);

    const event = await service.getEventById('evt-1');
    assert.equal(event.eventId, 'evt-1');
    assert.equal(event.title, 'Cloud Canvas 2026');

    await assert.rejects(
      async () => {
        await service.getEventById('evt-nonexistent');
      },
      (err: any) => {
        assert.equal(err instanceof NotFoundError, true);
        assert.equal(err.code, 'EVENT_NOT_FOUND');
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  test('createEvent initializes confirmedCount to 0 and status to PUBLISHED with caller organizerId', async () => {
    let createdItem: any = null;
    const mockRepo = {
      create: async (item: EventItem) => {
        createdItem = item;
        return item;
      },
    } as unknown as EventRepository;

    const service = new EventService(mockRepo);
    const result = await service.createEvent('usr-org-1', {
      title: 'New Fest',
      description: 'Cultural Fest',
      category: 'Cultural',
      startAt: '2026-12-01T10:00:00.000Z',
      venue: 'Amphitheatre',
      capacity: 200,
    });

    assert.equal(result.confirmedCount, 0);
    assert.equal(result.status, 'PUBLISHED');
    assert.equal(result.organizerId, 'usr-org-1');
    assert.match(result.eventId, /^evt-/);
    assert.equal(createdItem?.title, 'New Fest');
  });

  test('updateEvent allows event owner to update event', async () => {
    const existing = { ...sampleEvents[0] };
    const mockRepo = {
      findById: async () => existing,
      update: async (_id: string, _org: string, updates: any) => ({
        ...existing,
        ...updates,
      }),
    } as unknown as EventRepository;

    const service = new EventService(mockRepo);
    const updated = await service.updateEvent('evt-1', 'usr-org-1', {
      title: 'Cloud Canvas 2026 (Updated)',
      capacity: 150,
    });

    assert.equal(updated.title, 'Cloud Canvas 2026 (Updated)');
    assert.equal(updated.capacity, 150);
  });

  test('updateEvent rejects non-owner with 403 FORBIDDEN', async () => {
    const existing = { ...sampleEvents[0] }; // organizerId: usr-org-1
    const mockRepo = {
      findById: async () => existing,
    } as unknown as EventRepository;

    const service = new EventService(mockRepo);
    await assert.rejects(
      async () => {
        await service.updateEvent('evt-1', 'usr-different-org', {
          title: 'Hacked Title',
        });
      },
      (err: any) => {
        assert.equal(err instanceof ForbiddenError, true);
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /You do not own this event/);
        return true;
      }
    );
  });

  test('updateEvent rejects capacity reduction below current confirmedCount with 400 INVALID_CAPACITY', async () => {
    const existing = { ...sampleEvents[0] }; // confirmedCount: 88
    const mockRepo = {
      findById: async () => existing,
    } as unknown as EventRepository;

    const service = new EventService(mockRepo);
    await assert.rejects(
      async () => {
        await service.updateEvent('evt-1', 'usr-org-1', {
          capacity: 50, // 50 < 88
        });
      },
      (err: any) => {
        assert.equal(err instanceof AppError, true);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'INVALID_CAPACITY');
        assert.match(err.message, /less than existing confirmed attendees/);
        return true;
      }
    );
  });

  test('updateEvent validates effective endAt relative to existing startAt when only endAt is updated', async () => {
    const existing = { ...sampleEvents[0] }; // startAt: 2026-11-15T09:00:00.000Z
    const mockRepo = {
      findById: async () => existing,
    } as unknown as EventRepository;

    const service = new EventService(mockRepo);
    await assert.rejects(
      async () => {
        await service.updateEvent('evt-1', 'usr-org-1', {
          endAt: '2026-11-10T09:00:00.000Z', // before startAt
        });
      },
      (err: any) => {
        assert.equal(err instanceof AppError, true);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'VALIDATION_ERROR');
        assert.match(err.message, /endAt must be after startAt/);
        return true;
      }
    );
  });

  test('updateEvent validates effective startAt relative to existing endAt when only startAt is updated', async () => {
    const existing = { ...sampleEvents[0] }; // endAt: 2026-11-16T18:00:00.000Z
    const mockRepo = {
      findById: async () => existing,
    } as unknown as EventRepository;

    const service = new EventService(mockRepo);
    await assert.rejects(
      async () => {
        await service.updateEvent('evt-1', 'usr-org-1', {
          startAt: '2026-11-20T09:00:00.000Z', // after endAt
        });
      },
      (err: any) => {
        assert.equal(err instanceof AppError, true);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'VALIDATION_ERROR');
        assert.match(err.message, /endAt must be after startAt/);
        return true;
      }
    );
  });

  test('updateEvent propagates 400 INVALID_CAPACITY when repository encounters concurrent capacity race', async () => {
    const existing = { ...sampleEvents[0], confirmedCount: 50 };
    const mockRepo = {
      findById: async () => existing,
      update: async () => {
        throw new AppError(
          400,
          'INVALID_CAPACITY',
          'Requested capacity is less than existing confirmed attendees.'
        );
      },
    } as unknown as EventRepository;

    const service = new EventService(mockRepo);
    await assert.rejects(
      async () => {
        // Appears valid against initial read (capacity 55 >= 50), but concurrent RSVP raised confirmedCount to 60
        await service.updateEvent('evt-1', 'usr-org-1', {
          capacity: 55,
        });
      },
      (err: any) => {
        assert.equal(err instanceof AppError, true);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'INVALID_CAPACITY');
        assert.match(err.message, /less than existing confirmed attendees/);
        return true;
      }
    );
  });
});
