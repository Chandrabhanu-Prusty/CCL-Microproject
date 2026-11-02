import { randomUUID } from 'node:crypto';
import { EventRepository } from '../repositories/event.repository.js';
import type { EventItem, CreateEventInput, UpdateEventInput, EventFilters } from '../types/event.js';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors.js';

export class EventService {
  private eventRepo: EventRepository;

  constructor(eventRepo?: EventRepository) {
    this.eventRepo = eventRepo ?? new EventRepository();
  }

  /**
   * Lists published events with optional category and search query filtering.
   * Leverages status-startAt-index GSI.
   */
  async listEvents(filters?: EventFilters): Promise<EventItem[]> {
    let events = await this.eventRepo.findPublished(filters?.category);

    if (filters?.q) {
      const term = filters.q.trim().toLowerCase();
      events = events.filter(
        (e) =>
          e.title.toLowerCase().includes(term) ||
          e.venue.toLowerCase().includes(term)
      );
    }

    return events;
  }

  /**
   * Retrieves single event by ID.
   */
  async getEventById(eventId: string): Promise<EventItem> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError('EVENT_NOT_FOUND', 'Event not found.');
    }
    return event;
  }

  /**
   * Creates a new campus event with initial status PUBLISHED and confirmedCount 0.
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
   * Enforces event ownership and capacity floor invariant.
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

    return this.eventRepo.update(eventId, callerUserId, input);
  }
}
