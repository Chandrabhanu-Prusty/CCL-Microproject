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

  test('reserveConfirmedSeat executes 3-item transaction creating RSVP and ACTIVE ticket with startAt condition', async () => {
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
    const res = await repo.reserveConfirmedSeat('evt-test-1', 'usr-1', 'rsvp-1', {
      ticketId: 'tkt-1',
      attendeeName: 'Chandrabhanu',
      attendeeEmail: 'chandrabhanu@vesit.edu',
      eventTitle: 'Hackathon',
      eventVenue: 'Lab 502',
      eventStartAt: '2027-11-15T09:00:00.000Z',
    });

    assert.equal(res.success, true);
    assert.equal(executedCommand.input.TransactItems.length, 3);

    // Item 0: MarqueEvents Update (includes #startAt > :now)
    const eventUpdate = executedCommand.input.TransactItems[0].Update;
    assert.equal(eventUpdate.TableName, 'MarqueEvents');
    assert.match(eventUpdate.UpdateExpression, /confirmedCount = confirmedCount \+ :inc/);
    assert.match(
      eventUpdate.ConditionExpression,
      /#status = :published AND confirmedCount < capacity AND #startAt > :now/
    );
    assert.equal(eventUpdate.ExpressionAttributeNames['#startAt'], 'startAt');
    assert.equal(typeof eventUpdate.ExpressionAttributeValues[':now'], 'string');

    // Item 1: MarqueRSVPs Put
    const rsvpPut = executedCommand.input.TransactItems[1].Put;
    assert.equal(rsvpPut.TableName, 'MarqueRSVPs');
    assert.equal(rsvpPut.Item.status, 'CONFIRMED');
    assert.equal(rsvpPut.Item.ticketId, 'tkt-1');
    assert.match(rsvpPut.ConditionExpression, /attribute_not_exists\(attendeeId\) OR #status = :cancelled/);

    // Item 2: MarqueTickets Put (ACTIVE ticket with all required attributes)
    const ticketPut = executedCommand.input.TransactItems[2].Put;
    assert.equal(ticketPut.TableName, 'MarqueTickets');
    assert.equal(ticketPut.Item.ticketId, 'tkt-1');
    assert.equal(ticketPut.Item.eventId, 'evt-test-1');
    assert.equal(ticketPut.Item.attendeeId, 'usr-1');
    assert.equal(ticketPut.Item.attendeeName, 'Chandrabhanu');
    assert.equal(ticketPut.Item.attendeeEmail, 'chandrabhanu@vesit.edu');
    assert.equal(ticketPut.Item.eventTitle, 'Hackathon');
    assert.equal(ticketPut.Item.eventVenue, 'Lab 502');
    assert.equal(ticketPut.Item.status, 'ACTIVE');
    assert.match(ticketPut.ConditionExpression, /attribute_not_exists\(ticketId\)/);
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
          { Code: 'None' },
        ];
        throw error;
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new RsvpRepository(mockDocClient);
    const res = await repo.reserveConfirmedSeat('evt-test-1', 'usr-1', 'rsvp-1', 'tkt-1');

    assert.equal(res.success, false);
    assert.equal(res.reason, 'DUPLICATE_REGISTRATION');
  });

  test('reserveConfirmedSeat maps capacity full condition failure when event is ongoing but full', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async (cmd: any) => {
        if (cmd.input?.Key?.eventId) {
          // get event check
          return {
            Item: {
              eventId: 'evt-test-1',
              status: 'PUBLISHED',
              startAt: '2028-11-15T09:00:00.000Z',
              capacity: 100,
              confirmedCount: 100,
            },
          };
        }
        const error: any = new Error('Transaction cancelled');
        error.name = 'TransactionCanceledException';
        error.CancellationReasons = [
          { Code: 'ConditionalCheckFailed' }, // Index 0: Events Update
          { Code: 'None' },
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

  test('reserveConfirmedSeat maps REGISTRATION_CLOSED when event started before transaction execution', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async (cmd: any) => {
        if (cmd.input?.Key?.eventId) {
          // Strongly consistent read returns event that has already started!
          return {
            Item: {
              eventId: 'evt-test-1',
              status: 'PUBLISHED',
              startAt: '2020-01-01T00:00:00.000Z', // Past startAt!
              capacity: 100,
              confirmedCount: 50,
            },
          };
        }
        const error: any = new Error('Transaction cancelled');
        error.name = 'TransactionCanceledException';
        error.CancellationReasons = [
          { Code: 'ConditionalCheckFailed' }, // Index 0 failed because #startAt > :now failed!
          { Code: 'None' },
          { Code: 'None' },
        ];
        throw error;
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new RsvpRepository(mockDocClient);
    const res = await repo.reserveConfirmedSeat('evt-test-1', 'usr-1', 'rsvp-1', 'tkt-1');

    assert.equal(res.success, false);
    assert.equal(res.reason, 'REGISTRATION_CLOSED');
  });

  test('joinWaitlist executes 3-item transaction incrementing waitlistCount and creating queue entry with startAt condition', async () => {
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

    // Item 0: MarqueEvents Update (increments waitlistCount and checks startAt)
    const eventUpdate = executedCommand.input.TransactItems[0].Update;
    assert.equal(eventUpdate.TableName, 'MarqueEvents');
    assert.match(eventUpdate.UpdateExpression, /waitlistCount = if_not_exists\(waitlistCount, :zero\) \+ :inc/);
    assert.match(
      eventUpdate.ConditionExpression,
      /#status = :published AND confirmedCount >= capacity AND #startAt > :now/
    );

    // Item 1: MarqueRSVPs Put (WAITLISTED)
    const rsvpPut = executedCommand.input.TransactItems[1].Put;
    assert.equal(rsvpPut.TableName, 'MarqueRSVPs');
    assert.equal(rsvpPut.Item.status, 'WAITLISTED');
    assert.equal(rsvpPut.Item.queueKey, '2026-11-01T12:00:00.000Z#usr-1');
    assert.match(rsvpPut.ConditionExpression, /attribute_not_exists\(attendeeId\) OR #status = :cancelled/);

    // Item 2: MarqueWaitlist Put
    const waitlistPut = executedCommand.input.TransactItems[2].Put;
    assert.equal(waitlistPut.TableName, 'MarqueWaitlist');
    assert.equal(waitlistPut.Item.status, 'WAITING');
    assert.match(waitlistPut.ConditionExpression, /attribute_not_exists\(queueKey\)/);
  });

  test('joinWaitlist maps REGISTRATION_CLOSED when event started before transaction execution', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async (cmd: any) => {
        if (cmd.input?.Key?.eventId) {
          return {
            Item: {
              eventId: 'evt-test-1',
              status: 'PUBLISHED',
              startAt: '2020-01-01T00:00:00.000Z',
              capacity: 100,
              confirmedCount: 100,
            },
          };
        }
        const error: any = new Error('Transaction cancelled');
        error.name = 'TransactionCanceledException';
        error.CancellationReasons = [
          { Code: 'ConditionalCheckFailed' },
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
    assert.equal(res.reason, 'REGISTRATION_CLOSED');
  });

  test('joinWaitlist maps seat available condition failure (event condition failed)', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async (cmd: any) => {
        if (cmd.input?.Key?.eventId) {
          return {
            Item: {
              eventId: 'evt-test-1',
              status: 'PUBLISHED',
              startAt: '2028-11-15T09:00:00.000Z',
              capacity: 100,
              confirmedCount: 99, // Seat opened up!
            },
          };
        }
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
    assert.equal(executedCommand.input.FilterExpression, undefined); // No filter expression
  });

  test('getWaitlistCount completely paginates across multiple pages using LastEvaluatedKey', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const executedCommands: any[] = [];
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommands.push(cmd);
        if (executedCommands.length === 1) {
          return {
            Count: 45,
            LastEvaluatedKey: { eventId: 'evt-test-1', queueKey: 'key-page-1' },
          };
        }
        if (executedCommands.length === 2) {
          return {
            Count: 55,
            LastEvaluatedKey: { eventId: 'evt-test-1', queueKey: 'key-page-2' },
          };
        }
        return {
          Count: 12,
        };
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new RsvpRepository(mockDocClient);
    const totalCount = await repo.getWaitlistCount('evt-test-1');

    assert.equal(totalCount, 112); // 45 + 55 + 12
    assert.equal(executedCommands.length, 3);
    assert.equal(executedCommands[0].input.ExclusiveStartKey, undefined);
    assert.deepEqual(executedCommands[1].input.ExclusiveStartKey, {
      eventId: 'evt-test-1',
      queueKey: 'key-page-1',
    });
    assert.deepEqual(executedCommands[2].input.ExclusiveStartKey, {
      eventId: 'evt-test-1',
      queueKey: 'key-page-2',
    });
  });

  test('promoteWaitlistEntry executes atomic transaction: cancels old RSVP/ticket and promotes candidate with ACTIVE ticket', async () => {
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
      'tkt-old-1',
      sampleWaitlistEntry,
      'tkt-promoted-1',
      {
        eventTitle: 'Hackathon 2026',
        eventVenue: 'Campus Auditorium',
        eventStartAt: '2027-11-15T09:00:00.000Z',
      }
    );

    assert.equal(res.success, true);
    assert.equal(executedCommand.input.TransactItems.length, 6);

    // Item 0: Update cancelled RSVP to CANCELLED (does NOT delete)
    const cancelUpdate = executedCommand.input.TransactItems[0].Update;
    assert.equal(cancelUpdate.TableName, 'MarqueRSVPs');
    assert.equal(cancelUpdate.Key.attendeeId, 'usr-cancelling');
    assert.match(cancelUpdate.UpdateExpression, /SET #status = :cancelled, updatedAt = :now REMOVE queueKey/);
    assert.match(cancelUpdate.ConditionExpression, /#status = :confirmed/);

    // Item 1: Update old ticket to CANCELLED (does NOT delete)
    const ticketCancel = executedCommand.input.TransactItems[1].Update;
    assert.equal(ticketCancel.TableName, 'MarqueTickets');
    assert.equal(ticketCancel.Key.ticketId, 'tkt-old-1');
    assert.match(ticketCancel.UpdateExpression, /SET #status = :cancelled/);
    assert.match(ticketCancel.ConditionExpression, /attribute_exists\(ticketId\)/);

    // Item 2: Update candidate RSVP to CONFIRMED
    const candidateRsvp = executedCommand.input.TransactItems[2].Update;
    assert.equal(candidateRsvp.TableName, 'MarqueRSVPs');
    assert.equal(candidateRsvp.Key.attendeeId, 'usr-waitlist-1');
    assert.match(candidateRsvp.UpdateExpression, /SET #status = :confirmed, ticketId = :ticketId/);

    // Item 3: Put candidate's new ACTIVE ticket in MarqueTickets
    const newTicketPut = executedCommand.input.TransactItems[3].Put;
    assert.equal(newTicketPut.TableName, 'MarqueTickets');
    assert.equal(newTicketPut.Item.ticketId, 'tkt-promoted-1');
    assert.equal(newTicketPut.Item.attendeeId, 'usr-waitlist-1');
    assert.equal(newTicketPut.Item.attendeeName, 'Waitlist User');
    assert.equal(newTicketPut.Item.status, 'ACTIVE');
    assert.equal(newTicketPut.Item.eventTitle, 'Hackathon 2026');

    // Item 4: Delete candidate from MarqueWaitlist
    const wlDelete = executedCommand.input.TransactItems[4].Delete;
    assert.equal(wlDelete.TableName, 'MarqueWaitlist');
    assert.equal(wlDelete.Key.queueKey, sampleWaitlistEntry.queueKey);

    // Item 5: Decrement waitlistCount on MarqueEvents
    const eventUpdate = executedCommand.input.TransactItems[5].Update;
    assert.equal(eventUpdate.TableName, 'MarqueEvents');
    assert.match(eventUpdate.UpdateExpression, /waitlistCount = waitlistCount - :dec/);
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
          { Code: 'None' },
          { Code: 'ConditionalCheckFailed' }, // Candidate was already promoted!
          { Code: 'None' },
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
      'tkt-old-1',
      sampleWaitlistEntry,
      'tkt-promoted-1'
    );

    assert.equal(res.success, false);
    assert.equal(res.reason, 'CONCURRENT_PROMOTION_CONFLICT');
  });

  test('cancelConfirmedWithoutWaitlist updates RSVP and ticket to CANCELLED, and decrements confirmedCount', async () => {
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
    const res = await repo.cancelConfirmedWithoutWaitlist('evt-test-1', 'usr-cancelling', 'tkt-1');

    assert.equal(res.success, true);
    assert.equal(executedCommand.input.TransactItems.length, 3);

    // Item 0: Update RSVP to CANCELLED
    const rsvpUpdate = executedCommand.input.TransactItems[0].Update;
    assert.equal(rsvpUpdate.TableName, 'MarqueRSVPs');
    assert.match(rsvpUpdate.UpdateExpression, /SET #status = :cancelled, updatedAt = :now REMOVE queueKey/);

    // Item 1: Update Ticket to CANCELLED
    const ticketUpdate = executedCommand.input.TransactItems[1].Update;
    assert.equal(ticketUpdate.TableName, 'MarqueTickets');
    assert.equal(ticketUpdate.Key.ticketId, 'tkt-1');
    assert.match(ticketUpdate.UpdateExpression, /SET #status = :cancelled/);

    // Item 2: Decrement confirmedCount on MarqueEvents
    const eventUpdate = executedCommand.input.TransactItems[2].Update;
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
          { Code: 'None' },
          { Code: 'ConditionalCheckFailed' }, // waitlistCount was not zero!
        ];
        throw error;
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new RsvpRepository(mockDocClient);
    const res = await repo.cancelConfirmedWithoutWaitlist('evt-test-1', 'usr-cancelling', 'tkt-1');

    assert.equal(res.success, false);
    assert.equal(res.reason, 'WAITLIST_NOT_EMPTY');
  });

  test('cancelWaitlistedRsvp updates RSVP to CANCELLED and deletes waitlist queue entry', async () => {
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

    // Item 0: Update WAITLISTED RSVP to CANCELLED
    const rsvpUpdate = executedCommand.input.TransactItems[0].Update;
    assert.equal(rsvpUpdate.TableName, 'MarqueRSVPs');
    assert.match(rsvpUpdate.UpdateExpression, /SET #status = :cancelled, updatedAt = :now REMOVE queueKey/);
    assert.match(rsvpUpdate.ConditionExpression, /#status = :waitlisted/);

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
