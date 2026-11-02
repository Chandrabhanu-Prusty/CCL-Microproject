import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { backfillLegacyTickets } from '../../src/scripts/backfill-tickets.js';
import { resetEnvCache, getEnv } from '../../src/config/env.js';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

describe('Backfill Legacy Tickets Unit Tests', () => {
  const testEnv = {
    USERS_TABLE: 'MarqueUsers',
    EVENTS_TABLE: 'MarqueEvents',
    EVENT_STAFF_TABLE: 'MarqueEventStaff',
    RSVPS_TABLE: 'MarqueRSVPs',
    WAITLIST_TABLE: 'MarqueWaitlist',
    TICKETS_TABLE: 'MarqueTickets',
    S3_BUCKET: 'actual-s3-bucket-name',
    JWT_SECRET: 'super-secret-key-that-is-at-least-32-chars-long',
    JWT_EXPIRES_IN: '24h',
  };

  test('backfillLegacyTickets in dry-run mode identifies missing tickets without calling Put', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const puts: any[] = [];
    const mockDocClient = {
      send: async (cmd: any) => {
        // Scan on RSVPs table
        if (cmd.input?.TableName === 'MarqueRSVPs') {
          return {
            Items: [
              {
                eventId: 'evt-1',
                attendeeId: 'usr-1',
                ticketId: 'tkt-legacy-1',
                status: 'CONFIRMED',
                createdAt: '2026-11-01T10:00:00.000Z',
              },
            ],
          };
        }
        // Get on MarqueTickets: ticket missing!
        if (cmd.input?.TableName === 'MarqueTickets' && cmd.input?.Key) {
          return {}; // Missing ticket!
        }
        // Get on MarqueEvents: event exists
        if (cmd.input?.TableName === 'MarqueEvents') {
          return {
            Item: {
              eventId: 'evt-1',
              title: 'Hackathon 2026',
              venue: 'Campus Lab',
              startAt: '2027-11-15T09:00:00.000Z',
            },
          };
        }
        // Get on MarqueUsers: user profile exists
        if (cmd.input?.TableName === 'MarqueUsers') {
          return {
            Item: {
              userId: 'usr-1',
              name: 'John Doe',
              email: 'john@vesit.edu',
            },
          };
        }
        if (cmd.input?.Item) {
          puts.push(cmd);
        }
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const summary = await backfillLegacyTickets({
      execute: false, // DRY RUN
      docClient: mockDocClient,
    });

    assert.equal(summary.dryRun, true);
    assert.equal(summary.inspectedRsvps, 1);
    assert.equal(summary.existingTickets, 0);
    assert.equal(summary.backfilledTickets, 1);
    assert.equal(puts.length, 0); // No Put commands in dry run!
  });

  test('backfillLegacyTickets in execute mode backfills missing ticket with actual metadata', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const puts: any[] = [];
    const mockDocClient = {
      send: async (cmd: any) => {
        if (cmd.input?.TableName === 'MarqueRSVPs') {
          return {
            Items: [
              {
                eventId: 'evt-1',
                attendeeId: 'usr-1',
                ticketId: 'tkt-legacy-1',
                status: 'CONFIRMED',
                createdAt: '2026-11-01T10:00:00.000Z',
              },
            ],
          };
        }
        if (cmd.input?.TableName === 'MarqueTickets' && cmd.input?.Key) {
          return {}; // Missing ticket!
        }
        if (cmd.input?.TableName === 'MarqueEvents') {
          return {
            Item: {
              eventId: 'evt-1',
              title: 'Hackathon 2026',
              venue: 'Campus Lab',
              startAt: '2027-11-15T09:00:00.000Z',
            },
          };
        }
        if (cmd.input?.TableName === 'MarqueUsers') {
          return {
            Item: {
              userId: 'usr-1',
              name: 'John Doe',
              email: 'john@vesit.edu',
            },
          };
        }
        if (cmd.input?.TableName === 'MarqueTickets' && cmd.input?.Item) {
          puts.push(cmd);
          return {};
        }
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const summary = await backfillLegacyTickets({
      execute: true, // EXECUTE
      docClient: mockDocClient,
    });

    assert.equal(summary.dryRun, false);
    assert.equal(summary.backfilledTickets, 1);
    assert.equal(puts.length, 1);
    assert.equal(puts[0].input.Item.ticketId, 'tkt-legacy-1');
    assert.equal(puts[0].input.Item.status, 'ACTIVE');
    assert.equal(puts[0].input.Item.attendeeName, 'John Doe');
    assert.equal(puts[0].input.Item.eventTitle, 'Hackathon 2026');
    assert.equal(puts[0].input.ConditionExpression, 'attribute_not_exists(ticketId)');
  });

  test('backfillLegacyTickets skips when ticket already exists or metadata missing', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const puts: any[] = [];
    const mockDocClient = {
      send: async (cmd: any) => {
        if (cmd.input?.TableName === 'MarqueRSVPs') {
          return {
            Items: [
              {
                eventId: 'evt-1',
                attendeeId: 'usr-1',
                ticketId: 'tkt-exists-1',
                status: 'CONFIRMED',
              },
              {
                eventId: 'evt-missing',
                attendeeId: 'usr-missing',
                ticketId: 'tkt-orphan-2',
                status: 'CONFIRMED',
              },
            ],
          };
        }
        if (cmd.input?.TableName === 'MarqueTickets' && cmd.input?.Key) {
          if (cmd.input?.Key?.ticketId === 'tkt-exists-1') {
            return { Item: { ticketId: 'tkt-exists-1', status: 'ACTIVE' } };
          }
          return {}; // tkt-orphan-2 is missing from tickets table
        }
        if (cmd.input?.TableName === 'MarqueEvents') {
          return {}; // Event missing!
        }
        if (cmd.input?.TableName === 'MarqueUsers') {
          return {}; // User missing!
        }
        if (cmd.input?.TableName === 'MarqueTickets' && cmd.input?.Item) {
          puts.push(cmd);
        }
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const summary = await backfillLegacyTickets({
      execute: true,
      docClient: mockDocClient,
    });

    assert.equal(summary.inspectedRsvps, 2);
    assert.equal(summary.existingTickets, 1);
    assert.equal(summary.skippedMissingMetadata, 1);
    assert.equal(summary.backfilledTickets, 0);
    assert.equal(puts.length, 0); // No ticket created because metadata was missing!
  });
});
