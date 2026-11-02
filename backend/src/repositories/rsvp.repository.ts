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

export interface ReserveConfirmedResult {
  success: boolean;
  reason?: 'DUPLICATE_REGISTRATION' | 'EVENT_FULL' | 'EVENT_NOT_PUBLISHED' | 'TRANSACTION_FAILED';
}

export interface JoinWaitlistResult {
  success: boolean;
  reason?: 'DUPLICATE_REGISTRATION' | 'SEAT_AVAILABLE' | 'EVENT_NOT_PUBLISHED' | 'TRANSACTION_FAILED';
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
   * Increments confirmedCount on MarqueEvents and puts CONFIRMED RSVP on MarqueRSVPs.
   */
  async reserveConfirmedSeat(
    eventId: string,
    attendeeId: string,
    rsvpId: string,
    ticketId: string
  ): Promise<ReserveConfirmedResult> {
    const now = new Date().toISOString();

    try {
      await this.getClient().send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.eventsTable,
                Key: { eventId },
                UpdateExpression: 'SET confirmedCount = confirmedCount + :inc, updatedAt = :now',
                ConditionExpression: '#status = :published AND confirmedCount < capacity',
                ExpressionAttributeNames: {
                  '#status': 'status',
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
                ConditionExpression: 'attribute_not_exists(eventId) AND attribute_not_exists(attendeeId)',
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
          // Check whether capacity was full or status was not published
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

    try {
      await this.getClient().send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.eventsTable,
                Key: { eventId },
                UpdateExpression: 'SET waitlistCount = if_not_exists(waitlistCount, :zero) + :inc, updatedAt = :now',
                ConditionExpression: '#status = :published AND confirmedCount >= capacity',
                ExpressionAttributeNames: {
                  '#status': 'status',
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
                ConditionExpression: 'attribute_not_exists(eventId) AND attribute_not_exists(attendeeId)',
              },
            },
            {
              Put: {
                TableName: this.waitlistTable,
                Item: {
                  eventId,
                  queueKey,
                  attendeeId,
                  attendeeName: attendeeName || '',
                  attendeeEmail,
                  status: 'WAITING',
                  createdAt: now,
                },
                ConditionExpression: 'attribute_not_exists(eventId) AND attribute_not_exists(queueKey)',
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
        // Index 0: Event update failed (e.g. seat became available: confirmedCount < capacity)
        if (reasons[0]?.Code === 'ConditionalCheckFailed') {
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
   * Returns current active waitlist entry count for an event via strongly consistent read.
   */
  async getWaitlistCount(eventId: string): Promise<number> {
    const result = await this.getClient().send(
      new QueryCommand({
        TableName: this.waitlistTable,
        KeyConditionExpression: 'eventId = :eventId',
        ExpressionAttributeValues: {
          ':eventId': eventId,
        },
        Select: 'COUNT',
        ConsistentRead: true,
      })
    );
    return result.Count ?? 0;
  }

  /**
   * Executes atomic promotion transaction:
   * 1. Deletes cancelled attendee's confirmed RSVP.
   * 2. Updates oldest waitlist candidate's RSVP to CONFIRMED and removes queueKey.
   * 3. Deletes waitlist candidate's queue entry from MarqueWaitlist.
   * 4. Decrements waitlistCount on MarqueEvents.
   * confirmedCount remains unchanged.
   */
  async promoteWaitlistEntry(
    eventId: string,
    cancelledAttendeeId: string,
    candidate: WaitlistItem,
    newTicketId: string
  ): Promise<PromoteResult> {
    const now = new Date().toISOString();

    try {
      await this.getClient().send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: this.rsvpsTable,
                Key: { eventId, attendeeId: cancelledAttendeeId },
                ConditionExpression: 'attribute_exists(eventId) AND #status = :confirmed',
                ExpressionAttributeNames: {
                  '#status': 'status',
                },
                ExpressionAttributeValues: {
                  ':confirmed': 'CONFIRMED',
                },
              },
            },
            {
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
            },
            {
              Delete: {
                TableName: this.waitlistTable,
                Key: { eventId, queueKey: candidate.queueKey },
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
        // Index 0: Cancelled RSVP not found
        if (reasons[0]?.Code === 'ConditionalCheckFailed') {
          return { success: false, reason: 'RSVP_NOT_FOUND' };
        }
        // Index 1, 2, or 3: Candidate was concurrently promoted or waitlist changed
        return { success: false, reason: 'CONCURRENT_PROMOTION_CONFLICT' };
      }
      throw err;
    }
  }

  /**
   * Executes atomic cancellation when waitlist is empty:
   * 1. Deletes cancelled attendee's confirmed RSVP.
   * 2. Decrements confirmedCount on MarqueEvents with condition that waitlistCount is 0 or absent.
   */
  async cancelConfirmedWithoutWaitlist(
    eventId: string,
    cancelledAttendeeId: string
  ): Promise<CancelConfirmedNoWaitlistResult> {
    const now = new Date().toISOString();

    try {
      await this.getClient().send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: this.rsvpsTable,
                Key: { eventId, attendeeId: cancelledAttendeeId },
                ConditionExpression: 'attribute_exists(eventId) AND #status = :confirmed',
                ExpressionAttributeNames: {
                  '#status': 'status',
                },
                ExpressionAttributeValues: {
                  ':confirmed': 'CONFIRMED',
                },
              },
            },
            {
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
        // Index 0: RSVP was not confirmed or missing
        if (reasons[0]?.Code === 'ConditionalCheckFailed') {
          return { success: false, reason: 'RSVP_NOT_FOUND' };
        }
        // Index 1: waitlistCount was not zero (concurrent waitlist insertion!)
        if (reasons[1]?.Code === 'ConditionalCheckFailed') {
          return { success: false, reason: 'WAITLIST_NOT_EMPTY' };
        }
      }
      throw err;
    }
  }

  /**
   * Executes atomic waitlisted RSVP cancellation:
   * 1. Deletes attendee's WAITLISTED RSVP state.
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
              Delete: {
                TableName: this.rsvpsTable,
                Key: { eventId, attendeeId },
                ConditionExpression: 'attribute_exists(eventId) AND #status = :waitlisted',
                ExpressionAttributeNames: {
                  '#status': 'status',
                },
                ExpressionAttributeValues: {
                  ':waitlisted': 'WAITLISTED',
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
