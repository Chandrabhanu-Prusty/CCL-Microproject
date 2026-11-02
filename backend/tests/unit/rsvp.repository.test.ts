import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RsvpRepository } from '../../src/repositories/rsvp.repository.js';
import { resetEnvCache, getEnv } from '../../src/config/env.js';
import type { WaitlistItem } from '../../src/types/rsvp.js';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

describe('RsvpRepository Unit Tests (Mocked In-Memory DocumentClient)', () => {
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

  const sampleWaitlistEntry: WaitlistItem = {
    eventId: 'evt-test-1',
    queueKey: '2026-11-01T12:00:00.000Z#usr-waitlist-1',
    attendeeId: 'usr-waitlist-1',
    attendeeName: 'Waitlist User',
    attendeeEmail: 'waitlist@vesit.edu',
    status: 'WAITING',
    createdAt: '2026-11-01T12:00:00.000Z',
  };

  test('findByEventAndAttendee performs strongly consistent read', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return {
          Item: {
            eventId: 'evt-test-1',
            attendeeId: 'usr-1',
            rsvpId: 'rsvp-1',
            status: 'CONFIRMED',
          },
        };
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new RsvpRepository(mockDocClient);
    const result = await repo.findByEventAndAttendee('evt-test-1', 'usr-1');

    assert.equal(result?.rsvpId, 'rsvp-1');
    assert.equal(executedCommand.input.TableName, 'MarqueRSVPs');
    assert.equal(executedCommand.input.ConsistentRead, true);
    assert.equal(executedCommand.input.Key.eventId, 'evt-test-1');
    assert.equal(executedCommand.input.Key.attendeeId, 'usr-1');
  });

  test('reserveConfirmedSeat executes 2-item transaction with capacity and duplicate check conditions', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new RsvpRepository(mockDocClient);
    const res = await repo.reserveConfirmedSeat('evt-test-1', 'usr-1', 'rsvp-1', 'tkt-1');

    assert.equal(res.success, true);
    assert.equal(executedCommand.input.TransactItems.length, 2);

    // Item 0: MarqueEvents Update
    const eventUpdate = executedCommand.input.TransactItems[0].Update;
    assert.equal(eventUpdate.TableName, 'MarqueEvents');
    assert.match(eventUpdate.UpdateExpression, /confirmedCount = confirmedCount \+ :inc/);
    assert.match(eventUpdate.ConditionExpression, /#status = :published AND confirmedCount < capacity/);

    // Item 1: MarqueRSVPs Put
    const rsvpPut = executedCommand.input.TransactItems[1].Put;
    assert.equal(rsvpPut.TableName, 'MarqueRSVPs');
    assert.equal(rsvpPut.Item.status, 'CONFIRMED');
    assert.equal(rsvpPut.Item.ticketId, 'tkt-1');
    assert.match(rsvpPut.ConditionExpression, /attribute_not_exists\(eventId\) AND attribute_not_exists\(attendeeId\)/);
  });

  test('reserveConfirmedSeat maps duplicate registration condition failure', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async () => {
        const error: any = new Error('Transaction cancelled');
        error.name = 'TransactionCanceledException';
        error.CancellationReasons = [
          { Code: 'None' },
          { Code: 'ConditionalCheckFailed' }, // Index 1: RSVP Put
        ];
        throw error;
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new RsvpRepository(mockDocClient);
    const res = await repo.reserveConfirmedSeat('evt-test-1', 'usr-1', 'rsvp-1', 'tkt-1');

    assert.equal(res.success, false);
    assert.equal(res.reason, 'DUPLICATE_REGISTRATION');
  });

  test('reserveConfirmedSeat maps capacity full condition failure', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async () => {
        const error: any = new Error('Transaction cancelled');
        error.name = 'TransactionCanceledException';
        error.CancellationReasons = [
          { Code: 'ConditionalCheckFailed' }, // Index 0: Events Update
          { Code: 'None' },
        ];
        throw error;
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new RsvpRepository(mockDocClient);
    const res = await repo.reserveConfirmedSeat('evt-test-1', 'usr-1', 'rsvp-1', 'tkt-1');

    assert.equal(res.success, false);
    assert.equal(res.reason, 'EVENT_FULL');
  });

  test('joinWaitlist executes 3-item transaction incrementing waitlistCount and creating queue entry', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new RsvpRepository(mockDocClient);
    const res = await repo.joinWaitlist(
      'evt-test-1',
      'usr-1',
      'rsvp-1',
      '2026-11-01T12:00:00.000Z#usr-1',
      'User 1',
      'u1@vesit.edu'
    );

    assert.equal(res.success, true);
    assert.equal(executedCommand.input.TransactItems.length, 3);

    // Item 0: MarqueEvents Update (increments waitlistCount)
    const eventUpdate = executedCommand.input.TransactItems[0].Update;
    assert.equal(eventUpdate.TableName, 'MarqueEvents');
    assert.match(eventUpdate.UpdateExpression, /waitlistCount = if_not_exists\(waitlistCount, :zero\) \+ :inc/);
    assert.match(eventUpdate.ConditionExpression, /#status = :published AND confirmedCount >= capacity/);

    // Item 1: MarqueRSVPs Put (WAITLISTED)
    const rsvpPut = executedCommand.input.TransactItems[1].Put;
    assert.equal(rsvpPut.TableName, 'MarqueRSVPs');
    assert.equal(rsvpPut.Item.status, 'WAITLISTED');
    assert.equal(rsvpPut.Item.queueKey, '2026-11-01T12:00:00.000Z#usr-1');

    // Item 2: MarqueWaitlist Put
    const waitlistPut = executedCommand.input.TransactItems[2].Put;
    assert.equal(waitlistPut.TableName, 'MarqueWaitlist');
    assert.equal(waitlistPut.Item.status, 'WAITING');
    assert.match(waitlistPut.ConditionExpression, /attribute_not_exists\(eventId\) AND attribute_not_exists\(queueKey\)/);
  });

  test('joinWaitlist maps seat available condition failure (event condition failed)', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async () => {
        const error: any = new Error('Transaction cancelled');
        error.name = 'TransactionCanceledException';
        error.CancellationReasons = [
          { Code: 'ConditionalCheckFailed' }, // confirmedCount was < capacity!
          { Code: 'None' },
          { Code: 'None' },
        ];
        throw error;
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new RsvpRepository(mockDocClient);
    const res = await repo.joinWaitlist(
      'evt-test-1',
      'usr-1',
      'rsvp-1',
      '2026-11-01T12:00:00.000Z#usr-1',
      'User 1',
      'u1@vesit.edu'
    );

    assert.equal(res.success, false);
    assert.equal(res.reason, 'SEAT_AVAILABLE');
  });

  test('getOldestWaitlistEntry queries chronological order with ScanIndexForward and ConsistentRead', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return { Items: [sampleWaitlistEntry] };
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new RsvpRepository(mockDocClient);
    const entry = await repo.getOldestWaitlistEntry('evt-test-1');

    assert.equal(entry?.attendeeId, 'usr-waitlist-1');
    assert.equal(executedCommand.input.TableName, 'MarqueWaitlist');
    assert.equal(executedCommand.input.ScanIndexForward, true);
    assert.equal(executedCommand.input.Limit, 1);
    assert.equal(executedCommand.input.ConsistentRead, true);
    assert.equal(executedCommand.input.FilterExpression, undefined); // No filter expression!
  });

  test('promoteWaitlistEntry executes 4-item transaction transferring seat directly', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new RsvpRepository(mockDocClient);
    const res = await repo.promoteWaitlistEntry(
      'evt-test-1',
      'usr-cancelling',
      sampleWaitlistEntry,
      'tkt-promoted-1'
    );

    assert.equal(res.success, true);
    assert.equal(executedCommand.input.TransactItems.length, 4);

    // Item 0: Delete cancelled RSVP
    const cancelDelete = executedCommand.input.TransactItems[0].Delete;
    assert.equal(cancelDelete.TableName, 'MarqueRSVPs');
    assert.equal(cancelDelete.Key.attendeeId, 'usr-cancelling');
    assert.match(cancelDelete.ConditionExpression, /#status = :confirmed/);

    // Item 1: Update promoted candidate RSVP to CONFIRMED and remove queueKey
    const promoUpdate = executedCommand.input.TransactItems[1].Update;
    assert.equal(promoUpdate.TableName, 'MarqueRSVPs');
    assert.equal(promoUpdate.Key.attendeeId, 'usr-waitlist-1');
    assert.match(promoUpdate.UpdateExpression, /SET #status = :confirmed, ticketId = :ticketId, updatedAt = :now REMOVE queueKey/);

    // Item 2: Delete exact queue entry from MarqueWaitlist
    const wlDelete = executedCommand.input.TransactItems[2].Delete;
    assert.equal(wlDelete.TableName, 'MarqueWaitlist');
    assert.equal(wlDelete.Key.queueKey, sampleWaitlistEntry.queueKey);

    // Item 3: Decrement waitlistCount on MarqueEvents
    const eventUpdate = executedCommand.input.TransactItems[3].Update;
    assert.equal(eventUpdate.TableName, 'MarqueEvents');
    assert.match(eventUpdate.UpdateExpression, /waitlistCount = waitlistCount - :dec/);
    assert.match(eventUpdate.ConditionExpression, /waitlistCount > :zero/);
  });

  test('promoteWaitlistEntry maps concurrent promotion failure', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async () => {
        const error: any = new Error('Transaction cancelled');
        error.name = 'TransactionCanceledException';
        error.CancellationReasons = [
          { Code: 'None' },
          { Code: 'ConditionalCheckFailed' }, // Candidate was already promoted!
          { Code: 'None' },
          { Code: 'None' },
        ];
        throw error;
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new RsvpRepository(mockDocClient);
    const res = await repo.promoteWaitlistEntry(
      'evt-test-1',
      'usr-cancelling',
      sampleWaitlistEntry,
      'tkt-promoted-1'
    );

    assert.equal(res.success, false);
    assert.equal(res.reason, 'CONCURRENT_PROMOTION_CONFLICT');
  });

  test('cancelConfirmedWithoutWaitlist executes 2-item transaction verifying waitlistCount is 0 or absent', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new RsvpRepository(mockDocClient);
    const res = await repo.cancelConfirmedWithoutWaitlist('evt-test-1', 'usr-cancelling');

    assert.equal(res.success, true);
    assert.equal(executedCommand.input.TransactItems.length, 2);

    // Item 1: Decrement confirmedCount on MarqueEvents
    const eventUpdate = executedCommand.input.TransactItems[1].Update;
    assert.equal(eventUpdate.TableName, 'MarqueEvents');
    assert.match(eventUpdate.UpdateExpression, /confirmedCount = confirmedCount - :dec/);
    assert.match(
      eventUpdate.ConditionExpression,
      /confirmedCount > :zero AND \(attribute_not_exists\(waitlistCount\) OR waitlistCount = :zero\)/
    );
  });

  test('cancelConfirmedWithoutWaitlist detects concurrent waitlist insertion', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async () => {
        const error: any = new Error('Transaction cancelled');
        error.name = 'TransactionCanceledException';
        error.CancellationReasons = [
          { Code: 'None' },
          { Code: 'ConditionalCheckFailed' }, // waitlistCount was not zero!
        ];
        throw error;
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new RsvpRepository(mockDocClient);
    const res = await repo.cancelConfirmedWithoutWaitlist('evt-test-1', 'usr-cancelling');

    assert.equal(res.success, false);
    assert.equal(res.reason, 'WAITLIST_NOT_EMPTY');
  });

  test('cancelWaitlistedRsvp executes 3-item transaction deleting both RSVP state and queue entry', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new RsvpRepository(mockDocClient);
    const res = await repo.cancelWaitlistedRsvp('evt-test-1', 'usr-1', '2026-11-01T12:00:00.000Z#usr-1');

    assert.equal(res.success, true);
    assert.equal(executedCommand.input.TransactItems.length, 3);

    // Item 0: Delete WAITLISTED RSVP
    const rsvpDelete = executedCommand.input.TransactItems[0].Delete;
    assert.equal(rsvpDelete.TableName, 'MarqueRSVPs');
    assert.match(rsvpDelete.ConditionExpression, /#status = :waitlisted/);

    // Item 1: Delete from MarqueWaitlist
    const wlDelete = executedCommand.input.TransactItems[1].Delete;
    assert.equal(wlDelete.TableName, 'MarqueWaitlist');
    assert.equal(wlDelete.Key.queueKey, '2026-11-01T12:00:00.000Z#usr-1');

    // Item 2: Decrement waitlistCount
    const eventUpdate = executedCommand.input.TransactItems[2].Update;
    assert.equal(eventUpdate.TableName, 'MarqueEvents');
    assert.match(eventUpdate.ConditionExpression, /waitlistCount > :zero/);
  });

  test('findRsvpsByAttendee queries attendee-index GSI and paginates with LastEvaluatedKey', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const rsvp1 = { eventId: 'evt-1', attendeeId: 'usr-1', rsvpId: 'r1', status: 'CONFIRMED' as const };
    const rsvp2 = { eventId: 'evt-2', attendeeId: 'usr-1', rsvpId: 'r2', status: 'WAITLISTED' as const };
    const executedCommands: any[] = [];

    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommands.push(cmd);
        if (executedCommands.length === 1) {
          return {
            Items: [rsvp1],
            LastEvaluatedKey: { eventId: 'evt-1', attendeeId: 'usr-1', createdAt: '2026-11-01T10:00:00.000Z' },
          };
        }
        return {
          Items: [rsvp2],
        };
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new RsvpRepository(mockDocClient);
    const results = await repo.findRsvpsByAttendee('usr-1');

    assert.equal(results.length, 2);
    assert.equal(results[0].eventId, 'evt-1');
    assert.equal(results[1].eventId, 'evt-2');
    assert.equal(executedCommands.length, 2);
    assert.equal(executedCommands[0].input.ExclusiveStartKey, undefined);
    assert.deepEqual(executedCommands[1].input.ExclusiveStartKey, {
      eventId: 'evt-1',
      attendeeId: 'usr-1',
      createdAt: '2026-11-01T10:00:00.000Z',
    });
  });
});
