import { randomUUID } from 'node:crypto';
import { EventRepository } from '../repositories/event.repository.js';
import type { EventItem, CreateEventInput, UpdateEventInput, EventFilters } from '../types/event.js';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors.js';

export class EventService {
  constructor(private eventRepo: EventRepository = new EventRepository()) {}

  /**
   * Retrieves published events with optional filtering.
   * Chronologically ordered by startAt via status-startAt-index GSI.
   */
  async listEvents(filters?: EventFilters): Promise<EventItem[]> {
    const events = await this.eventRepo.findPublished(filters?.category);

    if (filters?.q) {
      const qLower = filters.q.toLowerCase().trim();
      return events.filter(
        (e) =>
          e.title.toLowerCase().includes(qLower) ||
          e.venue.toLowerCase().includes(qLower) ||
          e.description.toLowerCase().includes(qLower)
      );
    }

    return events;
  }

  /**
   * Retrieves single event by ID with strongly consistent read.
   */
  async getEventById(eventId: string): Promise<EventItem> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError('EVENT_NOT_FOUND', 'Event not found.');
    }
    return event;
  }

  /**
   * Creates a new campus event with caller as organizerId.
   */
  async createEvent(organizerId: string, input: CreateEventInput): Promise<EventItem> {
    const now = new Date().toISOString();
    const eventId = `evt-${randomUUID()}`;

    const newEvent: EventItem = {
      eventId,
      title: input.title,
      description: input.description,
      category: input.category,
      startAt: input.startAt,
      endAt: input.endAt,
      venue: input.venue,
      capacity: input.capacity,
      confirmedCount: 0,
      waitlistCount: 0,
      status: 'PUBLISHED',
      organizerId,
      bannerUrl: input.bannerUrl,
      createdAt: now,
      updatedAt: now,
    };

    return this.eventRepo.create(newEvent);
  }

  /**
   * Updates an existing event.
   * Enforces event ownership, capacity floor invariant, and chronological dates.
   */
  async updateEvent(
    eventId: string,
    callerUserId: string,
    input: UpdateEventInput
  ): Promise<EventItem> {
    const existing = await this.eventRepo.findById(eventId);
    if (!existing) {
      throw new NotFoundError('EVENT_NOT_FOUND', 'Event not found.');
    }

    if (existing.organizerId !== callerUserId) {
      throw new ForbiddenError('Access forbidden. You do not own this event.');
    }

    if (input.capacity !== undefined && input.capacity < existing.confirmedCount) {
      throw new AppError(
        400,
        'INVALID_CAPACITY',
        'Requested capacity is less than existing confirmed attendees.'
      );
    }

    const effectiveStartAt = input.startAt ?? existing.startAt;
    const effectiveEndAt = input.endAt ?? existing.endAt;
    if (effectiveStartAt && effectiveEndAt) {
      if (new Date(effectiveEndAt).getTime() <= new Date(effectiveStartAt).getTime()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'endAt must be after startAt');
      }
    }

    return this.eventRepo.update(eventId, callerUserId, input);
  }
}
