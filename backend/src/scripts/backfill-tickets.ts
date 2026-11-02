/**
 * Idempotent Backfill Utility for Legacy Marque RSVPs & Tickets
 *
 * Scans MarqueRSVPs for active confirmed registrations with ticketId,
 * checks if corresponding ticket exists in MarqueTickets, and idempotently
 * backfills missing active tickets using actual event and user profile data.
 *
 * Safety rules:
 * - Defaults to DRY-RUN mode. Pass --execute to apply changes.
 * - Never inserts placeholder or fabricated data.
 * - Never overwrites an existing ticket.
 * - Never modifies CHECKED_IN or CANCELLED tickets.
 * - Ignores WAITLISTED and CANCELLED RSVPs.
 */

import {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  PutCommand,
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
      const { eventId, attendeeId, ticketId, createdAt } = rsvp;

      if (!ticketId) {
        continue;
      }

      // Check if ticket already exists in MarqueTickets
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

      // Reconstruct ticket metadata ONLY from actual event and user records
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

      if (!event || !user || !user.email || !event.title) {
        console.warn(
          `[TICKET-BACKFILL] Skipping RSVP ${rsvp.rsvpId}: missing event (${eventId}) or user profile (${attendeeId}).`
        );
        summary.skippedMissingMetadata++;
        continue;
      }

      const reconstructedTicket = {
        ticketId,
        eventId,
        attendeeId,
        attendeeName: user.name || user.email.split('@')[0],
        attendeeEmail: user.email,
        eventTitle: event.title,
        eventVenue: event.venue,
        eventStartAt: event.startAt,
        status: 'ACTIVE',
        issuedAt: createdAt || new Date().toISOString(),
      };

      if (!isExecute) {
        console.log(
          `[DRY-RUN] Would create ticket ${ticketId} for attendee ${attendeeId} (${user.email}) on event "${event.title}".`
        );
        summary.backfilledTickets++;
      } else {
        await client.send(
          new PutCommand({
            TableName: env.TICKETS_TABLE,
            Item: reconstructedTicket,
            ConditionExpression: 'attribute_not_exists(ticketId)',
          })
        );
        console.log(
          `[EXECUTED] Created ticket ${ticketId} for attendee ${attendeeId} on event "${event.title}".`
        );
        summary.backfilledTickets++;
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
if (process.argv[1]?.endsWith('backfill-tickets.ts') || process.argv[1]?.endsWith('backfill-tickets.js')) {
  const execute = process.argv.includes('--execute');
  backfillLegacyTickets({ execute })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[TICKET-BACKFILL] Fatal error during backfill:', err);
      process.exit(1);
    });
}
