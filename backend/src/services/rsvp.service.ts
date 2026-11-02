import { randomUUID } from 'node:crypto';
import { RsvpRepository } from '../repositories/rsvp.repository.js';
import { EventRepository } from '../repositories/event.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import type { TokenPayload } from '../types/auth.js';
import type {
  RsvpResult,
  CancelRsvpResult,
  UserRsvpSummary,
} from '../types/rsvp.js';
import { NotFoundError, ConflictError, AppError } from '../utils/errors.js';

export class RsvpService {
  constructor(
    private rsvpRepo: RsvpRepository = new RsvpRepository(),
    private eventRepo: EventRepository = new EventRepository(),
    private userRepo: UserRepository = new UserRepository()
  ) {}

  /**
   * Registers an RSVP or enters FIFO waitlist for an event.
   * Atomically protects capacity invariants, prevents duplicate registrations,
   * and retries confirmed seats if one becomes available before waitlist commit.
   */
  async rsvpEvent(eventId: string, caller: TokenPayload): Promise<RsvpResult> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError('EVENT_NOT_FOUND', 'Event not found.');
    }

    if (event.status !== 'PUBLISHED') {
      throw new AppError(400, 'EVENT_NOT_PUBLISHED', 'Event is not open for registration.');
    }

    if (event.startAt && new Date(event.startAt).getTime() < Date.now()) {
      throw new AppError(400, 'REGISTRATION_CLOSED', 'Registration for this event is closed.');
    }

    // Check duplicate active registration for caller
    const existingRsvp = await this.rsvpRepo.findByEventAndAttendee(eventId, caller.userId);
    if (existingRsvp && (existingRsvp.status === 'CONFIRMED' || existingRsvp.status === 'WAITLISTED')) {
      throw new ConflictError('DUPLICATE_REGISTRATION', 'You have already registered for this event.');
    }

    // Lookup user display name for waitlist record
    let userName: string | undefined = undefined;
    try {
      const userProfile = await this.userRepo.findById(caller.userId);
      userName = userProfile?.name;
    } catch {
      // Fallback if user profile lookup fails
    }

    // Reservation execution with bounded retries for concurrency contention
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const currentEvent = attempt === 0 ? event : await this.eventRepo.findById(eventId);
      if (!currentEvent || currentEvent.status !== 'PUBLISHED') {
        throw new AppError(400, 'REGISTRATION_CLOSED', 'Registration for this event is closed.');
      }

      if (currentEvent.confirmedCount < currentEvent.capacity) {
        // Path A: Seat available -> attempt atomic confirmed seat reservation
        const rsvpId = `rsvp-${randomUUID()}`;
        const ticketId = `tkt-${randomUUID().replace(/-/g, '').slice(0, 16)}`;

        const res = await this.rsvpRepo.reserveConfirmedSeat(
          eventId,
          caller.userId,
          rsvpId,
          ticketId
        );

        if (res.success) {
          return {
            status: 'CONFIRMED',
            rsvpId,
            ticketId,
            message: 'Registration confirmed. Your digital pass is available.',
          };
        }

        if (res.reason === 'DUPLICATE_REGISTRATION') {
          throw new ConflictError('DUPLICATE_REGISTRATION', 'You have already registered for this event.');
        }

        if (res.reason === 'EVENT_FULL') {
          // Final seat was taken concurrently; proceed immediately to waitlist path
          continue;
        }
      } else {
        // Path B: Capacity exhausted -> attempt atomic waitlist registration
        const rsvpId = `rsvp-${randomUUID()}`;
        const now = new Date().toISOString();
        const queueKey = `${now}#${caller.userId}`;

        const res = await this.rsvpRepo.joinWaitlist(
          eventId,
          caller.userId,
          rsvpId,
          queueKey,
          userName,
          caller.email
        );

        if (res.success) {
          const queuePosition = await this.rsvpRepo.getWaitlistCount(eventId);
          return {
            status: 'WAITLISTED',
            rsvpId,
            queuePosition: Math.max(1, queuePosition),
            queueKey,
            message: 'Event is currently full. You have been placed in the FIFO waitlist.',
          };
        }

        if (res.reason === 'DUPLICATE_REGISTRATION') {
          throw new ConflictError('DUPLICATE_REGISTRATION', 'You have already registered for this event.');
        }

        if (res.reason === 'SEAT_AVAILABLE') {
          // A seat became available concurrently! Retry confirmed reservation path
          continue;
        }
      }
    }

    throw new AppError(
      409,
      'CONCURRENT_UPDATE_CONFLICT',
      'Could not complete registration due to high contention. Please try again.'
    );
  }

  /**
   * Cancels caller's active registration.
   * If CONFIRMED and waitlist exists -> atomically promotes oldest waitlisted candidate.
   * If CONFIRMED and waitlist empty -> atomically decrements confirmedCount (verifying waitlistCount == 0).
   * If WAITLISTED -> atomically deletes waitlist queue entry and RSVP state.
   */
  async cancelRsvp(eventId: string, caller: TokenPayload): Promise<CancelRsvpResult> {
    let existingRsvp = await this.rsvpRepo.findByEventAndAttendee(eventId, caller.userId);
    if (!existingRsvp || (existingRsvp.status !== 'CONFIRMED' && existingRsvp.status !== 'WAITLISTED')) {
      throw new NotFoundError('RSVP_NOT_FOUND', 'Active registration not found for this event.');
    }

    // Branch A: Waitlisted attendee cancellation
    if (existingRsvp.status === 'WAITLISTED') {
      const queueKey = existingRsvp.queueKey || `${existingRsvp.createdAt}#${caller.userId}`;
      const res = await this.rsvpRepo.cancelWaitlistedRsvp(eventId, caller.userId, queueKey);

      if (res.success) {
        return {
          message: 'Registration successfully cancelled.',
          promotedAttendee: null,
        };
      }

      if (res.reason === 'RSVP_NOT_FOUND') {
        throw new NotFoundError('RSVP_NOT_FOUND', 'Active registration not found for this event.');
      }

      // If concurrent promotion occurred while cancelling, reread state to handle safely
      const refreshed = await this.rsvpRepo.findByEventAndAttendee(eventId, caller.userId);
      if (!refreshed) {
        return {
          message: 'Registration successfully cancelled.',
          promotedAttendee: null,
        };
      }
      if (refreshed.status === 'CONFIRMED') {
        existingRsvp = refreshed;
        // Proceed into Branch B (confirmed cancellation)
      } else {
        throw new AppError(
          409,
          'CONCURRENT_UPDATE_CONFLICT',
          'Could not cancel waitlist registration due to contention.'
        );
      }
    }

    // Branch B: Confirmed attendee cancellation with bounded retries
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const oldestCandidate = await this.rsvpRepo.getOldestWaitlistEntry(eventId);

      if (oldestCandidate) {
        // Waitlist candidate found -> promote candidate
        const newTicketId = `tkt-${randomUUID().replace(/-/g, '').slice(0, 16)}`;
        const promoRes = await this.rsvpRepo.promoteWaitlistEntry(
          eventId,
          caller.userId,
          oldestCandidate,
          newTicketId
        );

        if (promoRes.success) {
          return {
            message: 'Registration successfully cancelled.',
            promotedAttendee: oldestCandidate.attendeeName || oldestCandidate.attendeeEmail,
          };
        }

        if (promoRes.reason === 'RSVP_NOT_FOUND') {
          throw new NotFoundError('RSVP_NOT_FOUND', 'Active registration not found for this event.');
        }

        // Concurrent promotion contention; retry to query next eligible candidate
        continue;
      } else {
        // Waitlist is empty -> decrement confirmedCount with waitlistCount == 0 condition
        const cancelRes = await this.rsvpRepo.cancelConfirmedWithoutWaitlist(eventId, caller.userId);

        if (cancelRes.success) {
          return {
            message: 'Registration successfully cancelled.',
            promotedAttendee: null,
          };
        }

        if (cancelRes.reason === 'RSVP_NOT_FOUND') {
          throw new NotFoundError('RSVP_NOT_FOUND', 'Active registration not found for this event.');
        }

        if (cancelRes.reason === 'WAITLIST_NOT_EMPTY') {
          // A concurrent waitlist entry arrived while we inspected; retry promotion branch
          continue;
        }
      }
    }

    throw new AppError(
      409,
      'CONCURRENT_UPDATE_CONFLICT',
      'Could not complete cancellation due to high contention. Please try again.'
    );
  }

  /**
   * Retrieves all registrations for caller using attendee-index GSI.
   * Enriches each registration with current event details.
   */
  async getMyRsvps(caller: TokenPayload): Promise<UserRsvpSummary[]> {
    const rsvps = await this.rsvpRepo.findRsvpsByAttendee(caller.userId);

    // Fetch and enrich event summaries
    const eventCache = new Map<string, { title: string; venue: string; startAt: string }>();

    const enriched = await Promise.all(
      rsvps.map(async (rsvp) => {
        let eventSummary = eventCache.get(rsvp.eventId);
        if (!eventSummary) {
          try {
            const event = await this.eventRepo.findById(rsvp.eventId);
            if (event) {
              eventSummary = {
                title: event.title,
                venue: event.venue,
                startAt: event.startAt,
              };
              eventCache.set(rsvp.eventId, eventSummary);
            }
          } catch {
            // Event fetch failure fallback
          }
        }

        return {
          rsvpId: rsvp.rsvpId,
          eventId: rsvp.eventId,
          status: rsvp.status,
          ticketId: rsvp.ticketId,
          queueKey: rsvp.queueKey ?? null,
          createdAt: rsvp.createdAt,
          event: eventSummary ?? {
            title: 'Campus Event',
            venue: 'Campus Venue',
            startAt: rsvp.createdAt,
          },
        };
      })
    );

    return enriched;
  }
}
