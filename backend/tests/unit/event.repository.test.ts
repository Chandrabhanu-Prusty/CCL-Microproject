import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EventRepository } from '../../src/repositories/event.repository.js';
import { resetEnvCache, getEnv } from '../../src/config/env.js';
import { ConflictError, NotFoundError, AppError } from '../../src/utils/errors.js';
import type { EventItem } from '../../src/types/event.js';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

describe('EventRepository Unit Tests (Mocked In-Memory DocumentClient)', () => {
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

  const sampleEvent: EventItem = {
    eventId: 'evt-test-1',
    title: 'Sample Hackathon',
    description: 'Premier campus event',
    category: 'Technology',
    startAt: '2026-11-15T09:00:00.000Z',
    endAt: '2026-11-17T17:00:00.000Z',
    venue: 'Lab 502',
    capacity: 100,
    confirmedCount: 0,
    status: 'PUBLISHED',
    organizerId: 'usr-org-1',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  };

  test('create puts item with condition attribute_not_exists(eventId)', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new EventRepository(mockDocClient);
    const created = await repo.create(sampleEvent);

    assert.equal(created.eventId, 'evt-test-1');
    assert.equal(executedCommand.input.TableName, 'MarqueEvents');
    assert.equal(executedCommand.input.ConditionExpression, 'attribute_not_exists(eventId)');
    assert.equal(executedCommand.input.Item.title, 'Sample Hackathon');
  });

  test('create throws 409 EVENT_ALREADY_EXISTS on collision', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async () => {
        const error = new Error('Condition failed');
        error.name = 'ConditionalCheckFailedException';
        throw error;
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new EventRepository(mockDocClient);
    await assert.rejects(
      async () => {
        await repo.create(sampleEvent);
      },
      (err: any) => {
        assert.equal(err instanceof ConflictError, true);
        assert.equal(err.code, 'EVENT_ALREADY_EXISTS');
        assert.equal(err.statusCode, 409);
        return true;
      }
    );
  });

  test('findById performs strongly consistent read', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return { Item: sampleEvent };
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new EventRepository(mockDocClient);
    const result = await repo.findById('evt-test-1');

    assert.equal(result?.eventId, 'evt-test-1');
    assert.equal(executedCommand.input.TableName, 'MarqueEvents');
    assert.equal(executedCommand.input.ConsistentRead, true);
    assert.equal(executedCommand.input.Key.eventId, 'evt-test-1');
  });

  test('findPublished queries status-startAt-index without DynamoDB Scan', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return { Items: [sampleEvent] };
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new EventRepository(mockDocClient);
    const events = await repo.findPublished();

    assert.equal(events.length, 1);
    assert.equal(executedCommand.input.TableName, 'MarqueEvents');
    assert.equal(executedCommand.input.IndexName, 'status-startAt-index');
    assert.equal(executedCommand.input.KeyConditionExpression, '#status = :status');
    assert.equal(executedCommand.input.ExpressionAttributeValues[':status'], 'PUBLISHED');
    assert.equal(executedCommand.input.ScanIndexForward, true);
  });

  test('findPublished applies category filter on GSI query', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return { Items: [sampleEvent] };
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new EventRepository(mockDocClient);
    await repo.findPublished('Technology');

    assert.equal(executedCommand.input.IndexName, 'status-startAt-index');
    assert.equal(executedCommand.input.FilterExpression, '#category = :category');
    assert.equal(executedCommand.input.ExpressionAttributeValues[':category'], 'Technology');
  });

  test('findPublished paginates across multiple DynamoDB pages using LastEvaluatedKey', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const eventPage1 = { ...sampleEvent, eventId: 'evt-page-1' };
    const eventPage2 = { ...sampleEvent, eventId: 'evt-page-2' };
    const executedCommands: any[] = [];

    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommands.push(cmd);
        if (executedCommands.length === 1) {
          return {
            Items: [eventPage1],
            LastEvaluatedKey: { eventId: 'evt-page-1', status: 'PUBLISHED', startAt: eventPage1.startAt },
          };
        }
        return {
          Items: [eventPage2],
        };
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new EventRepository(mockDocClient);
    const results = await repo.findPublished();

    assert.equal(results.length, 2);
    assert.equal(results[0].eventId, 'evt-page-1');
    assert.equal(results[1].eventId, 'evt-page-2');
    assert.equal(executedCommands.length, 2);
    assert.equal(executedCommands[0].input.ExclusiveStartKey, undefined);
    assert.deepEqual(executedCommands[1].input.ExclusiveStartKey, {
      eventId: 'evt-page-1',
      status: 'PUBLISHED',
      startAt: eventPage1.startAt,
    });
  });

  test('findByOrganizer queries organizer-index GSI', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return { Items: [sampleEvent] };
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new EventRepository(mockDocClient);
    const events = await repo.findByOrganizer('usr-org-1');

    assert.equal(events.length, 1);
    assert.equal(executedCommand.input.IndexName, 'organizer-index');
    assert.equal(executedCommand.input.KeyConditionExpression, 'organizerId = :organizerId');
    assert.equal(executedCommand.input.ExpressionAttributeValues[':organizerId'], 'usr-org-1');
  });

  test('findByOrganizer paginates across multiple DynamoDB pages using LastEvaluatedKey', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const eventPage1 = { ...sampleEvent, eventId: 'evt-org-p1' };
    const eventPage2 = { ...sampleEvent, eventId: 'evt-org-p2' };
    const executedCommands: any[] = [];

    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommands.push(cmd);
        if (executedCommands.length === 1) {
          return {
            Items: [eventPage1],
            LastEvaluatedKey: { eventId: 'evt-org-p1', organizerId: 'usr-org-1' },
          };
        }
        return {
          Items: [eventPage2],
        };
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new EventRepository(mockDocClient);
    const results = await repo.findByOrganizer('usr-org-1');

    assert.equal(results.length, 2);
    assert.equal(results[0].eventId, 'evt-org-p1');
    assert.equal(results[1].eventId, 'evt-org-p2');
    assert.equal(executedCommands.length, 2);
    assert.equal(executedCommands[0].input.ExclusiveStartKey, undefined);
    assert.deepEqual(executedCommands[1].input.ExclusiveStartKey, {
      eventId: 'evt-org-p1',
      organizerId: 'usr-org-1',
    });
  });

  test('update executes conditional update protecting ownership and capacity invariants', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const updatedEvent = { ...sampleEvent, capacity: 120 };
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return { Attributes: updatedEvent };
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new EventRepository(mockDocClient);
    const res = await repo.update('evt-test-1', 'usr-org-1', { capacity: 120 });

    assert.equal(res.capacity, 120);
    assert.equal(executedCommand.input.TableName, 'MarqueEvents');
    assert.match(executedCommand.input.ConditionExpression, /attribute_exists\(eventId\)/);
    assert.match(executedCommand.input.ConditionExpression, /organizerId = :organizerId/);
    assert.match(executedCommand.input.ConditionExpression, /confirmedCount <= :newCapacity/);
  });

  test('update throws HTTP 400 INVALID_CAPACITY when conditional check fails due to capacity race', async () => {
    resetEnvCache();
    getEnv(testEnv);

    // Mock client: first call to send is UpdateCommand -> throws ConditionalCheckFailedException
    // second call to send is GetCommand (findById) -> returns existing item with confirmedCount: 60
    const mockDocClient = {
      send: async (cmd: any) => {
        if (cmd.input && cmd.input.UpdateExpression) {
          const error = new Error('Conditional check failed');
          error.name = 'ConditionalCheckFailedException';
          throw error;
        }
        // GetCommand from findById
        return {
          Item: {
            ...sampleEvent,
            confirmedCount: 60,
          },
        };
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new EventRepository(mockDocClient);
    await assert.rejects(
      async () => {
        await repo.update('evt-test-1', 'usr-org-1', { capacity: 50 });
      },
      (err: any) => {
        assert.equal(err instanceof AppError, true);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'INVALID_CAPACITY');
        assert.match(err.message, /Requested capacity is less than existing confirmed attendees/);
        return true;
      }
    );
  });
});
