/**
 * Idempotent, Transaction-Safe Backfill Utility for Legacy Marque RSVPs & Tickets
 *
 * Scans MarqueRSVPs for active confirmed registrations with ticketId,
 * checks if corresponding ticket exists in MarqueTickets, and idempotently
 * backfills missing active tickets using actual event and user profile data.
 *
 * Safety rules:
 * - Defaults to DRY-RUN mode. Pass --execute to apply changes.
 * - Uses atomic DynamoDB transactions with ConditionCheck on MarqueRSVPs to ensure
 *   a concurrently cancelled RSVP can never receive a newly backfilled ACTIVE ticket.
 * - Never inserts placeholder or fabricated data.
 * - Never overwrites an existing ticket.
 * - Never modifies CHECKED_IN or CANCELLED tickets.
 * - Ignores WAITLISTED and CANCELLED RSVPs.
 */

import {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  TransactWriteCommand,
  type ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { getDynamoDB } from '../config/aws.js';
import { getEnv } from '../config/env.js';

export interface BackfillOptions {
  execute?: boolean;
  docClient?: DynamoDBDocumentClient;
}

export interface BackfillSummary {
  inspectedRsvps: number;
  existingTickets: number;
  backfilledTickets: number;
  skippedMissingMetadata: number;
  dryRun: boolean;
}

function isValidString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

export async function backfillLegacyTickets(
  options: BackfillOptions = {}
): Promise<BackfillSummary> {
  const isExecute = options.execute === true;
  const client = options.docClient ?? getDynamoDB();
  const env = getEnv();

  const summary: BackfillSummary = {
    inspectedRsvps: 0,
    existingTickets: 0,
    backfilledTickets: 0,
    skippedMissingMetadata: 0,
    dryRun: !isExecute,
  };

  console.log(
    `[TICKET-BACKFILL] Starting backfill check (${isExecute ? 'EXECUTE MODE' : 'DRY-RUN MODE'})...`
  );

  let lastEvaluatedKey: Record<string, unknown> | undefined = undefined;

  do {
    const scanInput: ScanCommandInput = {
      TableName: env.RSVPS_TABLE,
      FilterExpression: '#status = :confirmed AND attribute_exists(ticketId)',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':confirmed': 'CONFIRMED',
      },
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const scanResult = await client.send(new ScanCommand(scanInput));
    const items = scanResult.Items ?? [];

    for (const rsvp of items) {
      summary.inspectedRsvps++;
      const { eventId, attendeeId, ticketId, createdAt, rsvpId } = rsvp;
      const rsvpIdentifier = rsvpId || ticketId || `${eventId}#${attendeeId}`;

      // 1. Strict validation of RSVP required fields (no placeholder fallbacks)
      const missingRsvpFields: string[] = [];
      if (!isValidString(eventId)) missingRsvpFields.push('eventId');
      if (!isValidString(attendeeId)) missingRsvpFields.push('attendeeId');
      if (!isValidString(ticketId)) missingRsvpFields.push('ticketId');
      if (!isValidString(createdAt)) missingRsvpFields.push('createdAt');

      if (missingRsvpFields.length > 0) {
        console.warn(
          `[TICKET-BACKFILL] Skipping RSVP ${rsvpIdentifier}: missing or blank RSVP field(s) [${missingRsvpFields.join(', ')}].`
        );
        summary.skippedMissingMetadata++;
        continue;
      }

      // 2. Check if ticket already exists in MarqueTickets
      const ticketRes = await client.send(
        new GetCommand({
          TableName: env.TICKETS_TABLE,
          Key: { ticketId },
          ConsistentRead: true,
        })
      );

      if (ticketRes.Item) {
        // Ticket already exists; never overwrite or modify
        summary.existingTickets++;
        continue;
      }

      // 3. Retrieve event and user profile records
      const eventRes = await client.send(
        new GetCommand({
          TableName: env.EVENTS_TABLE,
          Key: { eventId },
          ConsistentRead: true,
        })
      );
      const event = eventRes.Item;

      const userRes = await client.send(
        new GetCommand({
          TableName: env.USERS_TABLE,
          Key: { userId: attendeeId, itemType: 'PROFILE' },
          ConsistentRead: true,
        })
      );
      const user = userRes.Item;

      // 4. Strict validation of Event & User profile metadata (no fake defaults!)
      const missingEntityFields: string[] = [];
      if (!event) {
        missingEntityFields.push('event entity missing');
      } else {
        if (!isValidString(event.title)) missingEntityFields.push('event.title');
        if (!isValidString(event.venue)) missingEntityFields.push('event.venue');
        if (!isValidString(event.startAt)) missingEntityFields.push('event.startAt');
      }

      if (!user) {
        missingEntityFields.push('user profile entity missing');
      } else {
        if (!isValidString(user.name)) missingEntityFields.push('user.name');
        if (!isValidString(user.email)) missingEntityFields.push('user.email');
      }

      if (!event || !user || missingEntityFields.length > 0) {
        console.warn(
          `[TICKET-BACKFILL] Skipping RSVP ${rsvpIdentifier}: missing or blank metadata [${missingEntityFields.join(', ')}].`
        );
        summary.skippedMissingMetadata++;
        continue;
      }

      const reconstructedTicket = {
        ticketId: ticketId.trim(),
        eventId: eventId.trim(),
        attendeeId: attendeeId.trim(),
        attendeeName: user.name.trim(),
        attendeeEmail: user.email.trim(),
        eventTitle: event.title.trim(),
        eventVenue: event.venue.trim(),
        eventStartAt: event.startAt.trim(),
        status: 'ACTIVE',
        issuedAt: createdAt.trim(),
      };

      if (!isExecute) {
        console.log(
          `[DRY-RUN] Would create ticket ${ticketId} for attendee ${attendeeId} (${user.email}) on event "${event.title}".`
        );
        summary.backfilledTickets++;
      } else {
        // Atomic transaction: verify RSVP is STILL CONFIRMED with matching ticketId before putting ticket
        try {
          await client.send(
            new TransactWriteCommand({
              TransactItems: [
                {
                  ConditionCheck: {
                    TableName: env.RSVPS_TABLE,
                    Key: { eventId, attendeeId },
                    ConditionExpression: '#status = :confirmed AND ticketId = :ticketId',
                    ExpressionAttributeNames: {
                      '#status': 'status',
                    },
                    ExpressionAttributeValues: {
                      ':confirmed': 'CONFIRMED',
                      ':ticketId': ticketId,
                    },
                  },
                },
                {
                  Put: {
                    TableName: env.TICKETS_TABLE,
                    Item: reconstructedTicket,
                    ConditionExpression: 'attribute_not_exists(ticketId)',
                  },
                },
              ],
            })
          );
          console.log(
            `[EXECUTED] Created ticket ${ticketId} for attendee ${attendeeId} on event "${event.title}".`
          );
          summary.backfilledTickets++;
        } catch (err: unknown) {
          if (
            typeof err === 'object' &&
            err !== null &&
            'name' in err &&
            err.name === 'TransactionCanceledException'
          ) {
            const reasons = (err as any).CancellationReasons || [];
            // Index 1: ticket was created concurrently
            if (reasons[1]?.Code === 'ConditionalCheckFailed') {
              summary.existingTickets++;
              console.log(
                `[CONCURRENCY] Ticket ${ticketId} was created concurrently. Skipping.`
              );
              continue;
            }
            // Index 0: RSVP is no longer CONFIRMED or ticketId changed
            if (reasons[0]?.Code === 'ConditionalCheckFailed') {
              console.warn(
                `[CONCURRENCY] RSVP for attendee ${attendeeId} on event ${eventId} is no longer CONFIRMED with ticket ${ticketId}. Skipping.`
              );
              continue;
            }
          }
          throw err;
        }
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  console.log(
    `[TICKET-BACKFILL] Completed: inspected ${summary.inspectedRsvps}, existing ${summary.existingTickets}, backfilled ${summary.backfilledTickets}, skipped ${summary.skippedMissingMetadata}.`
  );

  return summary;
}

// Direct invocation check
if (
  process.argv[1]?.endsWith('backfill-tickets.ts') ||
  process.argv[1]?.endsWith('backfill-tickets.js')
) {
  const execute = process.argv.includes('--execute');
  backfillLegacyTickets({ execute })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[TICKET-BACKFILL] Fatal error during backfill:', err);
      process.exit(1);
    });
}
