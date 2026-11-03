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

  test('backfillLegacyTickets in dry-run mode identifies missing tickets without writing to DynamoDB', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const writes: any[] = [];
    const mockDocClient = {
      send: async (cmd: any) => {
        // Scan on RSVPs table
        if (cmd.input?.TableName === 'MarqueRSVPs' && !cmd.input?.Key) {
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
        if (cmd.input?.TransactItems || cmd.input?.Item) {
          writes.push(cmd);
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
    assert.equal(summary.skippedMissingMetadata, 0);
    assert.equal(writes.length, 0); // No writes in dry run!
  });

  test('backfillLegacyTickets in execute mode uses atomic TransactWriteCommand with ConditionCheck', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedTransaction: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        if (cmd.input?.TableName === 'MarqueRSVPs' && !cmd.input?.Key) {
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
          return {}; // Ticket missing
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
        if (cmd.input?.TransactItems) {
          executedTransaction = cmd;
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
    assert.equal(summary.inspectedRsvps, 1);
    assert.equal(summary.backfilledTickets, 1);
    assert.notEqual(executedTransaction, null);

    const items = executedTransaction.input.TransactItems;
    assert.equal(items.length, 2);

    // Item 0: ConditionCheck on MarqueRSVPs ensuring still CONFIRMED with expected ticketId
    const condCheck = items[0].ConditionCheck;
    assert.equal(condCheck.TableName, 'MarqueRSVPs');
    assert.deepEqual(condCheck.Key, { eventId: 'evt-1', attendeeId: 'usr-1' });
    assert.equal(condCheck.ConditionExpression, '#status = :confirmed AND ticketId = :ticketId');
    assert.deepEqual(condCheck.ExpressionAttributeNames, { '#status': 'status' });
    assert.deepEqual(condCheck.ExpressionAttributeValues, {
      ':confirmed': 'CONFIRMED',
      ':ticketId': 'tkt-legacy-1',
    });

    // Item 1: Put on MarqueTickets
    const putTicket = items[1].Put;
    assert.equal(putTicket.TableName, 'MarqueTickets');
    assert.equal(putTicket.ConditionExpression, 'attribute_not_exists(ticketId)');
    assert.deepEqual(putTicket.Item, {
      ticketId: 'tkt-legacy-1',
      eventId: 'evt-1',
      attendeeId: 'usr-1',
      attendeeName: 'John Doe',
      attendeeEmail: 'john@vesit.edu',
      eventTitle: 'Hackathon 2026',
      eventVenue: 'Campus Lab',
      eventStartAt: '2027-11-15T09:00:00.000Z',
      status: 'ACTIVE',
      issuedAt: '2026-11-01T10:00:00.000Z', // exactly matches RSVP createdAt
    });
  });

  test('backfillLegacyTickets safely handles concurrent cancellation race condition', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async (cmd: any) => {
        if (cmd.input?.TableName === 'MarqueRSVPs' && !cmd.input?.Key) {
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
          return {}; // Missing initially
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
        if (cmd.input?.TransactItems) {
          const err: any = new Error('Transaction cancelled');
          err.name = 'TransactionCanceledException';
          err.CancellationReasons = [
            { Code: 'ConditionalCheckFailed' }, // RSVP condition failed (cancelled)
            { Code: 'None' },
          ];
          throw err;
        }
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const summary = await backfillLegacyTickets({
      execute: true,
      docClient: mockDocClient,
    });

    // Should skip safely without throwing and without incrementing backfilledTickets
    assert.equal(summary.inspectedRsvps, 1);
    assert.equal(summary.backfilledTickets, 0);
  });

  test('backfillLegacyTickets safely handles concurrent ticket creation', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async (cmd: any) => {
        if (cmd.input?.TableName === 'MarqueRSVPs' && !cmd.input?.Key) {
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
          return {};
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
        if (cmd.input?.TransactItems) {
          const err: any = new Error('Transaction cancelled');
          err.name = 'TransactionCanceledException';
          err.CancellationReasons = [
            { Code: 'None' },
            { Code: 'ConditionalCheckFailed' }, // Ticket condition failed (created concurrently)
          ];
          throw err;
        }
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const summary = await backfillLegacyTickets({
      execute: true,
      docClient: mockDocClient,
    });

    assert.equal(summary.inspectedRsvps, 1);
    assert.equal(summary.existingTickets, 1);
    assert.equal(summary.backfilledTickets, 0);
  });

  test('backfillLegacyTickets skips when ticket already exists on initial check', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const transactions: any[] = [];
    const mockDocClient = {
      send: async (cmd: any) => {
        if (cmd.input?.TableName === 'MarqueRSVPs' && !cmd.input?.Key) {
          return {
            Items: [
              {
                eventId: 'evt-1',
                attendeeId: 'usr-1',
                ticketId: 'tkt-exists-1',
                status: 'CONFIRMED',
                createdAt: '2026-11-01T10:00:00.000Z',
              },
            ],
          };
        }
        if (cmd.input?.TableName === 'MarqueTickets' && cmd.input?.Key) {
          return { Item: { ticketId: 'tkt-exists-1', status: 'ACTIVE' } };
        }
        if (cmd.input?.TransactItems) {
          transactions.push(cmd);
        }
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const summary = await backfillLegacyTickets({
      execute: true,
      docClient: mockDocClient,
    });

    assert.equal(summary.inspectedRsvps, 1);
    assert.equal(summary.existingTickets, 1);
    assert.equal(summary.backfilledTickets, 0);
    assert.equal(transactions.length, 0);
  });

  test('backfillLegacyTickets strictly skips and increments skippedMissingMetadata for any missing or blank field', async () => {
    resetEnvCache();
    getEnv(testEnv);

    // Test cases for missing RSVP fields, missing Event fields, and missing User fields
    const testCases = [
      {
        name: 'missing RSVP eventId',
        rsvp: { attendeeId: 'usr-1', ticketId: 'tkt-1', createdAt: '2026-11-01T10:00:00.000Z' },
        event: { title: 'T', venue: 'V', startAt: '2027-01-01T00:00:00.000Z' },
        user: { name: 'U', email: 'u@v.edu' },
      },
      {
        name: 'blank RSVP ticketId',
        rsvp: { eventId: 'evt-1', attendeeId: 'usr-1', ticketId: '   ', createdAt: '2026-11-01T10:00:00.000Z' },
        event: { title: 'T', venue: 'V', startAt: '2027-01-01T00:00:00.000Z' },
        user: { name: 'U', email: 'u@v.edu' },
      },
      {
        name: 'missing RSVP createdAt',
        rsvp: { eventId: 'evt-1', attendeeId: 'usr-1', ticketId: 'tkt-1' },
        event: { title: 'T', venue: 'V', startAt: '2027-01-01T00:00:00.000Z' },
        user: { name: 'U', email: 'u@v.edu' },
      },
      {
        name: 'missing Event entity completely',
        rsvp: { eventId: 'evt-missing', attendeeId: 'usr-1', ticketId: 'tkt-1', createdAt: '2026-11-01T10:00:00.000Z' },
        event: null,
        user: { name: 'U', email: 'u@v.edu' },
      },
      {
        name: 'blank Event title',
        rsvp: { eventId: 'evt-1', attendeeId: 'usr-1', ticketId: 'tkt-1', createdAt: '2026-11-01T10:00:00.000Z' },
        event: { title: '', venue: 'V', startAt: '2027-01-01T00:00:00.000Z' },
        user: { name: 'U', email: 'u@v.edu' },
      },
      {
        name: 'blank Event venue',
        rsvp: { eventId: 'evt-1', attendeeId: 'usr-1', ticketId: 'tkt-1', createdAt: '2026-11-01T10:00:00.000Z' },
        event: { title: 'T', venue: '  ', startAt: '2027-01-01T00:00:00.000Z' },
        user: { name: 'U', email: 'u@v.edu' },
      },
      {
        name: 'missing Event startAt',
        rsvp: { eventId: 'evt-1', attendeeId: 'usr-1', ticketId: 'tkt-1', createdAt: '2026-11-01T10:00:00.000Z' },
        event: { title: 'T', venue: 'V' },
        user: { name: 'U', email: 'u@v.edu' },
      },
      {
        name: 'missing User entity completely',
        rsvp: { eventId: 'evt-1', attendeeId: 'usr-missing', ticketId: 'tkt-1', createdAt: '2026-11-01T10:00:00.000Z' },
        event: { title: 'T', venue: 'V', startAt: '2027-01-01T00:00:00.000Z' },
        user: null,
      },
      {
        name: 'blank User name',
        rsvp: { eventId: 'evt-1', attendeeId: 'usr-1', ticketId: 'tkt-1', createdAt: '2026-11-01T10:00:00.000Z' },
        event: { title: 'T', venue: 'V', startAt: '2027-01-01T00:00:00.000Z' },
        user: { name: '   ', email: 'u@v.edu' },
      },
      {
        name: 'blank User email',
        rsvp: { eventId: 'evt-1', attendeeId: 'usr-1', ticketId: 'tkt-1', createdAt: '2026-11-01T10:00:00.000Z' },
        event: { title: 'T', venue: 'V', startAt: '2027-01-01T00:00:00.000Z' },
        user: { name: 'U', email: '' },
      },
    ];

    for (const tc of testCases) {
      let writeCalled = false;
      const mockDocClient = {
        send: async (cmd: any) => {
          if (cmd.input?.TableName === 'MarqueRSVPs' && !cmd.input?.Key) {
            return { Items: [tc.rsvp] };
          }
          if (cmd.input?.TableName === 'MarqueTickets' && cmd.input?.Key) {
            return {}; // Ticket missing
          }
          if (cmd.input?.TableName === 'MarqueEvents') {
            return tc.event ? { Item: tc.event } : {};
          }
          if (cmd.input?.TableName === 'MarqueUsers') {
            return tc.user ? { Item: tc.user } : {};
          }
          if (cmd.input?.TransactItems || cmd.input?.Item) {
            writeCalled = true;
          }
          return {};
        },
      } as unknown as DynamoDBDocumentClient;

      const summary = await backfillLegacyTickets({
        execute: true,
        docClient: mockDocClient,
      });

      assert.equal(
        summary.skippedMissingMetadata,
        1,
        `Expected 1 skipped for case: ${tc.name}`
      );
      assert.equal(summary.backfilledTickets, 0, `Expected 0 backfilled for case: ${tc.name}`);
      assert.equal(writeCalled, false, `Expected no writes for case: ${tc.name}`);
    }
  });

  test('backfillLegacyTickets skips when RSVP attendeeId is missing', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let writeExecuted = false;
    const mockDocClient = {
      send: async (cmd: any) => {
        // Scan on RSVPs table returns otherwise valid RSVP but missing attendeeId
        if (cmd.input?.TableName === 'MarqueRSVPs' && !cmd.input?.Key) {
          return {
            Items: [
              {
                eventId: 'evt-1',
                // attendeeId is missing!
                ticketId: 'tkt-legacy-1',
                status: 'CONFIRMED',
                createdAt: '2026-11-01T10:00:00.000Z',
              },
            ],
          };
        }
        // Get on MarqueTickets: ticket missing
        if (cmd.input?.TableName === 'MarqueTickets' && cmd.input?.Key) {
          return {};
        }
        // Valid Event record
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
        // Valid User record
        if (cmd.input?.TableName === 'MarqueUsers') {
          return {
            Item: {
              userId: 'usr-1',
              name: 'John Doe',
              email: 'john@vesit.edu',
            },
          };
        }
        // Detect if any TransactWriteCommand or PutCommand is executed
        if (
          cmd.constructor?.name === 'TransactWriteCommand' ||
          cmd.constructor?.name === 'PutCommand' ||
          cmd.input?.TransactItems ||
          cmd.input?.Item
        ) {
          writeExecuted = true;
          return {};
        }
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const summary = await backfillLegacyTickets({
      execute: true, // execute mode
      docClient: mockDocClient,
    });

    assert.equal(summary.skippedMissingMetadata, 1);
    assert.equal(summary.backfilledTickets, 0);
    assert.equal(writeExecuted, false);
  });
});
