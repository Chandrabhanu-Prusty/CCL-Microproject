import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
  type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { getDynamoDB } from '../config/aws.js';
import { getEnv } from '../config/env.js';
import type { RsvpItem, WaitlistItem } from '../types/rsvp.js';

export interface ReserveTicketInput {
  ticketId: string;
  attendeeName: string;
  attendeeEmail: string;
  eventTitle: string;
  eventVenue: string;
  eventStartAt: string;
}

export interface ReserveConfirmedResult {
  success: boolean;
  reason?:
    | 'DUPLICATE_REGISTRATION'
    | 'EVENT_FULL'
    | 'EVENT_NOT_PUBLISHED'
    | 'REGISTRATION_CLOSED'
    | 'TRANSACTION_FAILED';
}

export interface JoinWaitlistResult {
  success: boolean;
  reason?:
    | 'DUPLICATE_REGISTRATION'
    | 'SEAT_AVAILABLE'
    | 'EVENT_NOT_PUBLISHED'
    | 'REGISTRATION_CLOSED'
    | 'TRANSACTION_FAILED';
}

export interface PromoteResult {
  success: boolean;
  reason?: 'CONCURRENT_PROMOTION_CONFLICT' | 'RSVP_NOT_FOUND' | 'TRANSACTION_FAILED';
}

export interface CancelConfirmedNoWaitlistResult {
  success: boolean;
  reason?: 'WAITLIST_NOT_EMPTY' | 'RSVP_NOT_FOUND' | 'TRANSACTION_FAILED';
}

export interface CancelWaitlistedResult {
  success: boolean;
  reason?: 'CONCURRENT_WAITLIST_CONFLICT' | 'RSVP_NOT_FOUND' | 'TRANSACTION_FAILED';
}

export class RsvpRepository {
  private docClient: DynamoDBDocumentClient | null = null;

  constructor(customDocClient?: DynamoDBDocumentClient) {
    if (customDocClient) {
      this.docClient = customDocClient;
    }
  }

  private getClient(): DynamoDBDocumentClient {
    if (!this.docClient) {
      this.docClient = getDynamoDB();
    }
    return this.docClient;
  }

  private get rsvpsTable(): string {
    return getEnv().RSVPS_TABLE;
  }

  private get eventsTable(): string {
    return getEnv().EVENTS_TABLE;
  }

  private get waitlistTable(): string {
    return getEnv().WAITLIST_TABLE;
  }

  private get ticketsTable(): string {
    return getEnv().TICKETS_TABLE;
  }

  /**
   * Retrieves an attendee's active RSVP state for an event with strongly consistent read.
   */
  async findByEventAndAttendee(eventId: string, attendeeId: string): Promise<RsvpItem | null> {
    const result = await this.getClient().send(
      new GetCommand({
        TableName: this.rsvpsTable,
        Key: { eventId, attendeeId },
        ConsistentRead: true,
      })
    );
    return (result.Item as RsvpItem) ?? null;
  }

  /**
   * Executes atomic reservation transaction reserving a confirmed seat.
   * Increments confirmedCount on MarqueEvents, puts CONFIRMED RSVP on MarqueRSVPs,
   * and creates ACTIVE ticket on MarqueTickets in the same atomic transaction.
   */
  async reserveConfirmedSeat(
    eventId: string,
    attendeeId: string,
    rsvpId: string,
    ticketData: string | ReserveTicketInput
  ): Promise<ReserveConfirmedResult> {
    const now = new Date().toISOString();
    const ticketId = typeof ticketData === 'string' ? ticketData : ticketData.ticketId;
    const attendeeName =
      typeof ticketData === 'string'
        ? 'Attendee'
        : ticketData.attendeeName && ticketData.attendeeName.trim().length > 0
        ? ticketData.attendeeName.trim()
        : 'Attendee';
    const attendeeEmail = typeof ticketData === 'string' ? 'attendee@example.com' : ticketData.attendeeEmail;
    const eventTitle = typeof ticketData === 'string' ? 'Campus Event' : ticketData.eventTitle;
    const eventVenue = typeof ticketData === 'string' ? 'Campus Venue' : ticketData.eventVenue;
    const eventStartAt = typeof ticketData === 'string' ? now : ticketData.eventStartAt;

    try {
      await this.getClient().send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.eventsTable,
                Key: { eventId },
                UpdateExpression: 'SET confirmedCount = confirmedCount + :inc, updatedAt = :now',
                ConditionExpression: '#status = :published AND confirmedCount < capacity AND #startAt > :now',
                ExpressionAttributeNames: {
                  '#status': 'status',
                  '#startAt': 'startAt',
                },
                ExpressionAttributeValues: {
                  ':inc': 1,
                  ':now': now,
                  ':published': 'PUBLISHED',
                },
              },
            },
            {
              Put: {
                TableName: this.rsvpsTable,
                Item: {
                  eventId,
                  attendeeId,
                  rsvpId,
                  status: 'CONFIRMED',
                  ticketId,
                  createdAt: now,
                  updatedAt: now,
                },
                ConditionExpression: 'attribute_not_exists(attendeeId) OR #status = :cancelled',
                ExpressionAttributeNames: {
                  '#status': 'status',
                },
                ExpressionAttributeValues: {
                  ':cancelled': 'CANCELLED',
                },
              },
            },
            {
              Put: {
                TableName: this.ticketsTable,
                Item: {
                  ticketId,
                  eventId,
                  attendeeId,
                  attendeeName,
                  attendeeEmail,
                  eventTitle,
                  eventVenue,
                  eventStartAt,
                  status: 'ACTIVE',
                  issuedAt: now,
                },
                ConditionExpression: 'attribute_not_exists(ticketId)',
              },
            },
          ],
        })
      );
      return { success: true };
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        err.name === 'TransactionCanceledException'
      ) {
        const reasons = (err as any).CancellationReasons || [];
        // Index 1: RSVP conditional Put failed -> Duplicate registration
        if (reasons[1]?.Code === 'ConditionalCheckFailed') {
          return { success: false, reason: 'DUPLICATE_REGISTRATION' };
        }
        // Index 0: Event update failed
        if (reasons[0]?.Code === 'ConditionalCheckFailed') {
          try {
            const eventCheck = await this.getClient().send(
              new GetCommand({
                TableName: this.eventsTable,
                Key: { eventId },
                ConsistentRead: true,
              })
            );
            const currentEvent = eventCheck.Item;
            if (!currentEvent || currentEvent.status !== 'PUBLISHED') {
              return { success: false, reason: 'EVENT_NOT_PUBLISHED' };
            }
            if (currentEvent.startAt && currentEvent.startAt <= now) {
              return { success: false, reason: 'REGISTRATION_CLOSED' };
            }
          } catch {
            // fallback if event check read throws
          }
          return { success: false, reason: 'EVENT_FULL' };
        }
      }
      throw err;
    }
  }

  /**
   * Executes atomic waitlist transaction.
   * Increments waitlistCount on MarqueEvents, puts WAITLISTED RSVP on MarqueRSVPs,
   * and inserts FIFO queue entry into MarqueWaitlist.
   */
  async joinWaitlist(
    eventId: string,
    attendeeId: string,
    rsvpId: string,
    queueKey: string,
    attendeeName: string | undefined,
    attendeeEmail: string
  ): Promise<JoinWaitlistResult> {
    const now = new Date().toISOString();
    const resolvedName =
      attendeeName && attendeeName.trim().length > 0 ? attendeeName.trim() : 'Waitlisted Attendee';

    try {
      await this.getClient().send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.eventsTable,
                Key: { eventId },
                UpdateExpression: 'SET waitlistCount = if_not_exists(waitlistCount, :zero) + :inc, updatedAt = :now',
                ConditionExpression: '#status = :published AND confirmedCount >= capacity AND #startAt > :now',
                ExpressionAttributeNames: {
                  '#status': 'status',
                  '#startAt': 'startAt',
                },
                ExpressionAttributeValues: {
                  ':zero': 0,
                  ':inc': 1,
                  ':now': now,
                  ':published': 'PUBLISHED',
                },
              },
            },
            {
              Put: {
                TableName: this.rsvpsTable,
                Item: {
                  eventId,
                  attendeeId,
                  rsvpId,
                  status: 'WAITLISTED',
                  queueKey,
                  createdAt: now,
                  updatedAt: now,
                },
                ConditionExpression: 'attribute_not_exists(attendeeId) OR #status = :cancelled',
                ExpressionAttributeNames: {
                  '#status': 'status',
                },
                ExpressionAttributeValues: {
                  ':cancelled': 'CANCELLED',
                },
              },
            },
            {
              Put: {
                TableName: this.waitlistTable,
                Item: {
                  eventId,
                  queueKey,
                  attendeeId,
                  attendeeName: resolvedName,
                  attendeeEmail,
                  status: 'WAITING',
                  createdAt: now,
                },
                ConditionExpression: 'attribute_not_exists(queueKey)',
              },
            },
          ],
        })
      );
      return { success: true };
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        err.name === 'TransactionCanceledException'
      ) {
        const reasons = (err as any).CancellationReasons || [];
        // Index 1 or 2: RSVP / Waitlist duplicate check failed
        if (reasons[1]?.Code === 'ConditionalCheckFailed' || reasons[2]?.Code === 'ConditionalCheckFailed') {
          return { success: false, reason: 'DUPLICATE_REGISTRATION' };
        }
        // Index 0: Event update failed (e.g. seat became available: confirmedCount < capacity, or event closed)
        if (reasons[0]?.Code === 'ConditionalCheckFailed') {
          try {
            const eventCheck = await this.getClient().send(
              new GetCommand({
                TableName: this.eventsTable,
                Key: { eventId },
                ConsistentRead: true,
              })
            );
            const currentEvent = eventCheck.Item;
            if (!currentEvent || currentEvent.status !== 'PUBLISHED') {
              return { success: false, reason: 'EVENT_NOT_PUBLISHED' };
            }
            if (currentEvent.startAt && currentEvent.startAt <= now) {
              return { success: false, reason: 'REGISTRATION_CLOSED' };
            }
          } catch {
            // fallback
          }
          return { success: false, reason: 'SEAT_AVAILABLE' };
        }
      }
      throw err;
    }
  }

  /**
   * Retrieves the oldest FIFO candidate from MarqueWaitlist using strongly consistent read.
   * Without filter expression since table contains active waiting entries only.
   */
  async getOldestWaitlistEntry(eventId: string): Promise<WaitlistItem | null> {
    const result = await this.getClient().send(
      new QueryCommand({
        TableName: this.waitlistTable,
        KeyConditionExpression: 'eventId = :eventId',
        ExpressionAttributeValues: {
          ':eventId': eventId,
        },
        ScanIndexForward: true, // Chronological ordering (oldest first)
        Limit: 1,
        ConsistentRead: true,
      })
    );

    if (result.Items && result.Items.length > 0) {
      return result.Items[0] as WaitlistItem;
    }
    return null;
  }

  /**
   * Returns current active waitlist entry count for an event via strongly consistent read,
   * paginating across all pages using LastEvaluatedKey.
   */
  async getWaitlistCount(eventId: string): Promise<number> {
    let totalCount = 0;
    let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;

    do {
      const result = await this.getClient().send(
        new QueryCommand({
          TableName: this.waitlistTable,
          KeyConditionExpression: 'eventId = :eventId',
          ExpressionAttributeValues: {
            ':eventId': eventId,
          },
          Select: 'COUNT',
          ConsistentRead: true,
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );
      totalCount += result.Count ?? 0;
      lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastEvaluatedKey);

    return totalCount;
  }

  /**
   * Executes atomic promotion transaction:
   * 1. Updates cancelled attendee's RSVP to CANCELLED and removes queueKey.
   * 2. If old ticket exists, updates cancelling attendee's ticket to CANCELLED in MarqueTickets.
   * 3. Updates oldest waitlist candidate's RSVP to CONFIRMED with new ticketId.
   * 4. Creates candidate's new ticket with status ACTIVE in MarqueTickets.
   * 5. Deletes waitlist candidate's queue entry from MarqueWaitlist.
   * 6. Decrements waitlistCount on MarqueEvents.
   * confirmedCount remains unchanged.
   */
  async promoteWaitlistEntry(
    eventId: string,
    cancelledAttendeeId: string,
    arg3: string | undefined | WaitlistItem,
    arg4: WaitlistItem | string,
    arg5?: string,
    arg6?: {
      eventTitle: string;
      eventVenue: string;
      eventStartAt: string;
    }
  ): Promise<PromoteResult> {
    let oldTicketId: string | undefined;
    let candidate: WaitlistItem;
    let newTicketId: string;
    let eventDetails: { eventTitle: string; eventVenue: string; eventStartAt: string } | undefined;

    if (typeof arg3 === 'object' && arg3 !== null && 'queueKey' in arg3) {
      // (eventId, cancelledAttendeeId, candidate, newTicketId)
      candidate = arg3 as WaitlistItem;
      newTicketId = arg4 as string;
      oldTicketId = undefined;
      eventDetails = undefined;
    } else {
      // (eventId, cancelledAttendeeId, oldTicketId, candidate, newTicketId, eventDetails)
      oldTicketId = arg3 as string | undefined;
      candidate = arg4 as WaitlistItem;
      newTicketId = arg5 as string;
      eventDetails = arg6;
    }

    const now = new Date().toISOString();
    const candidateName =
      candidate.attendeeName && candidate.attendeeName.trim().length > 0
        ? candidate.attendeeName.trim()
        : 'Waitlisted Attendee';

    const transactItems: any[] = [
      // 0. Update cancelled attendee's RSVP to CANCELLED
      {
        Update: {
          TableName: this.rsvpsTable,
          Key: { eventId, attendeeId: cancelledAttendeeId },
          UpdateExpression: 'SET #status = :cancelled, updatedAt = :now REMOVE queueKey',
          ConditionExpression: 'attribute_exists(eventId) AND #status = :confirmed',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':cancelled': 'CANCELLED',
            ':confirmed': 'CONFIRMED',
            ':now': now,
          },
        },
      },
    ];

    let oldTicketIndex = -1;
    if (oldTicketId) {
      oldTicketIndex = transactItems.length;
      transactItems.push({
        Update: {
          TableName: this.ticketsTable,
          Key: { ticketId: oldTicketId },
          UpdateExpression: 'SET #status = :cancelled, updatedAt = :now',
          ConditionExpression: 'attribute_exists(ticketId)',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':cancelled': 'CANCELLED',
            ':now': now,
          },
        },
      });
    }

    // Update candidate's RSVP to CONFIRMED
    transactItems.push({
      Update: {
        TableName: this.rsvpsTable,
        Key: { eventId, attendeeId: candidate.attendeeId },
        UpdateExpression: 'SET #status = :confirmed, ticketId = :ticketId, updatedAt = :now REMOVE queueKey',
        ConditionExpression: 'attribute_exists(eventId) AND #status = :waitlisted',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':confirmed': 'CONFIRMED',
          ':waitlisted': 'WAITLISTED',
          ':ticketId': newTicketId,
          ':now': now,
        },
      },
    });

    // Create candidate's new ticket in MarqueTickets
    transactItems.push({
      Put: {
        TableName: this.ticketsTable,
        Item: {
          ticketId: newTicketId,
          eventId,
          attendeeId: candidate.attendeeId,
          attendeeName: candidateName,
          attendeeEmail: candidate.attendeeEmail,
          eventTitle: eventDetails?.eventTitle || 'Campus Event',
          eventVenue: eventDetails?.eventVenue || 'Campus Venue',
          eventStartAt: eventDetails?.eventStartAt || now,
          status: 'ACTIVE',
          issuedAt: now,
        },
        ConditionExpression: 'attribute_not_exists(ticketId)',
      },
    });

    // Delete candidate from MarqueWaitlist
    transactItems.push({
      Delete: {
        TableName: this.waitlistTable,
        Key: { eventId, queueKey: candidate.queueKey },
        ConditionExpression: 'attribute_exists(eventId) AND attribute_exists(queueKey)',
      },
    });

    // Decrement waitlistCount on MarqueEvents
    transactItems.push({
      Update: {
        TableName: this.eventsTable,
        Key: { eventId },
        UpdateExpression: 'SET waitlistCount = waitlistCount - :dec, updatedAt = :now',
        ConditionExpression: 'waitlistCount > :zero',
        ExpressionAttributeValues: {
          ':dec': 1,
          ':zero': 0,
          ':now': now,
        },
      },
    });

    try {
      await this.getClient().send(
        new TransactWriteCommand({
          TransactItems: transactItems,
        })
      );
      return { success: true };
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        err.name === 'TransactionCanceledException'
      ) {
        const reasons = (err as any).CancellationReasons || [];
        // Index 0: Cancelled RSVP condition failed
        if (reasons[0]?.Code === 'ConditionalCheckFailed') {
          return { success: false, reason: 'RSVP_NOT_FOUND' };
        }
        if (oldTicketIndex !== -1 && reasons[oldTicketIndex]?.Code === 'ConditionalCheckFailed') {
          return { success: false, reason: 'RSVP_NOT_FOUND' };
        }
        return { success: false, reason: 'CONCURRENT_PROMOTION_CONFLICT' };
      }
      throw err;
    }
  }

  /**
   * Executes atomic cancellation when waitlist is empty:
   * 1. Updates cancelled attendee's RSVP to CANCELLED and removes queueKey.
   * 2. If old ticket exists, updates ticket to CANCELLED in MarqueTickets.
   * 3. Decrements confirmedCount on MarqueEvents with condition that waitlistCount is 0 or absent.
   */
  async cancelConfirmedWithoutWaitlist(
    eventId: string,
    cancelledAttendeeId: string,
    oldTicketId?: string
  ): Promise<CancelConfirmedNoWaitlistResult> {
    const now = new Date().toISOString();

    const transactItems: any[] = [
      {
        Update: {
          TableName: this.rsvpsTable,
          Key: { eventId, attendeeId: cancelledAttendeeId },
          UpdateExpression: 'SET #status = :cancelled, updatedAt = :now REMOVE queueKey',
          ConditionExpression: 'attribute_exists(eventId) AND #status = :confirmed',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':cancelled': 'CANCELLED',
            ':confirmed': 'CONFIRMED',
            ':now': now,
          },
        },
      },
    ];

    let oldTicketIndex = -1;
    if (oldTicketId) {
      oldTicketIndex = transactItems.length;
      transactItems.push({
        Update: {
          TableName: this.ticketsTable,
          Key: { ticketId: oldTicketId },
          UpdateExpression: 'SET #status = :cancelled, updatedAt = :now',
          ConditionExpression: 'attribute_exists(ticketId)',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':cancelled': 'CANCELLED',
            ':now': now,
          },
        },
      });
    }

    const eventIndex = transactItems.length;
    transactItems.push({
      Update: {
        TableName: this.eventsTable,
        Key: { eventId },
        UpdateExpression: 'SET confirmedCount = confirmedCount - :dec, updatedAt = :now',
        ConditionExpression:
          'confirmedCount > :zero AND (attribute_not_exists(waitlistCount) OR waitlistCount = :zero)',
        ExpressionAttributeValues: {
          ':dec': 1,
          ':zero': 0,
          ':now': now,
        },
      },
    });

    try {
      await this.getClient().send(
        new TransactWriteCommand({
          TransactItems: transactItems,
        })
      );
      return { success: true };
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        err.name === 'TransactionCanceledException'
      ) {
        const reasons = (err as any).CancellationReasons || [];
        // Index 0: RSVP was not confirmed or missing
        if (reasons[0]?.Code === 'ConditionalCheckFailed') {
          return { success: false, reason: 'RSVP_NOT_FOUND' };
        }
        if (oldTicketIndex !== -1 && reasons[oldTicketIndex]?.Code === 'ConditionalCheckFailed') {
          return { success: false, reason: 'RSVP_NOT_FOUND' };
        }
        // Event update: waitlistCount was not zero (concurrent waitlist insertion!)
        if (reasons[eventIndex]?.Code === 'ConditionalCheckFailed') {
          return { success: false, reason: 'WAITLIST_NOT_EMPTY' };
        }
      }
      throw err;
    }
  }

  /**
   * Executes atomic waitlisted RSVP cancellation:
   * 1. Updates attendee's RSVP to CANCELLED and removes queueKey.
   * 2. Deletes exact waitlist queue entry from MarqueWaitlist.
   * 3. Decrements waitlistCount on MarqueEvents.
   */
  async cancelWaitlistedRsvp(
    eventId: string,
    attendeeId: string,
    queueKey: string
  ): Promise<CancelWaitlistedResult> {
    const now = new Date().toISOString();

    try {
      await this.getClient().send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.rsvpsTable,
                Key: { eventId, attendeeId },
                UpdateExpression: 'SET #status = :cancelled, updatedAt = :now REMOVE queueKey',
                ConditionExpression: 'attribute_exists(eventId) AND #status = :waitlisted',
                ExpressionAttributeNames: {
                  '#status': 'status',
                },
                ExpressionAttributeValues: {
                  ':cancelled': 'CANCELLED',
                  ':waitlisted': 'WAITLISTED',
                  ':now': now,
                },
              },
            },
            {
              Delete: {
                TableName: this.waitlistTable,
                Key: { eventId, queueKey },
                ConditionExpression: 'attribute_exists(eventId) AND attribute_exists(queueKey)',
              },
            },
            {
              Update: {
                TableName: this.eventsTable,
                Key: { eventId },
                UpdateExpression: 'SET waitlistCount = waitlistCount - :dec, updatedAt = :now',
                ConditionExpression: 'waitlistCount > :zero',
                ExpressionAttributeValues: {
                  ':dec': 1,
                  ':zero': 0,
                  ':now': now,
                },
              },
            },
          ],
        })
      );
      return { success: true };
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        err.name === 'TransactionCanceledException'
      ) {
        const reasons = (err as any).CancellationReasons || [];
        if (reasons[0]?.Code === 'ConditionalCheckFailed') {
          return { success: false, reason: 'RSVP_NOT_FOUND' };
        }
        return { success: false, reason: 'CONCURRENT_WAITLIST_CONFLICT' };
      }
      throw err;
    }
  }

  /**
   * Queries registrations for a specific attendee using attendee-index GSI.
   * Handles complete pagination across all pages using LastEvaluatedKey.
   */
  async findRsvpsByAttendee(attendeeId: string): Promise<RsvpItem[]> {
    const items: RsvpItem[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;

    do {
      const queryInput: QueryCommandInput = {
        TableName: this.rsvpsTable,
        IndexName: 'attendee-index',
        KeyConditionExpression: 'attendeeId = :aid',
        ExpressionAttributeValues: {
          ':aid': attendeeId,
        },
        ScanIndexForward: false, // Newest registrations first
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const result = await this.getClient().send(new QueryCommand(queryInput));
      if (result.Items) {
        items.push(...(result.Items as RsvpItem[]));
      }
      lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastEvaluatedKey);

    return items;
  }
}
