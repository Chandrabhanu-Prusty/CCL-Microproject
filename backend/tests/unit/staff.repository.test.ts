import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { StaffRepository } from '../../src/repositories/staff.repository.js';
import { resetEnvCache, getEnv } from '../../src/config/env.js';
import { ConflictError, NotFoundError } from '../../src/utils/errors.js';
import type { EventStaffRecord } from '../../src/types/staff.js';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

describe('StaffRepository Unit Tests (Mocked In-Memory DocumentClient)', () => {
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

  const sampleStaff: EventStaffRecord = {
    eventId: 'evt-ccl-1',
    userId: 'usr-coord-1',
    email: 'coord@vesit.edu',
    name: 'Coord User',
    permission: 'CHECK_IN',
    assignedAt: '2026-10-12T10:00:00.000Z',
    assignedBy: 'usr-org-1',
  };

  test('findStaffByEvent queries base table with eventId partition key', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return { Items: [sampleStaff] };
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new StaffRepository(mockDocClient);
    const staffList = await repo.findStaffByEvent('evt-ccl-1');

    assert.equal(staffList.length, 1);
    assert.equal(executedCommand.input.TableName, 'MarqueEventStaff');
    assert.equal(executedCommand.input.KeyConditionExpression, 'eventId = :eventId');
    assert.equal(executedCommand.input.ExpressionAttributeValues[':eventId'], 'evt-ccl-1');
  });

  test('findStaffMember retrieves single assignment via consistent read', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return { Item: sampleStaff };
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new StaffRepository(mockDocClient);
    const staff = await repo.findStaffMember('evt-ccl-1', 'usr-coord-1');

    assert.equal(staff?.userId, 'usr-coord-1');
    assert.equal(executedCommand.input.ConsistentRead, true);
    assert.equal(executedCommand.input.Key.eventId, 'evt-ccl-1');
    assert.equal(executedCommand.input.Key.userId, 'usr-coord-1');
  });

  test('assignStaff puts item with unique composite key condition', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new StaffRepository(mockDocClient);
    const res = await repo.assignStaff(sampleStaff);

    assert.equal(res.userId, 'usr-coord-1');
    assert.match(
      executedCommand.input.ConditionExpression,
      /attribute_not_exists\(eventId\) AND attribute_not_exists\(userId\)/
    );
  });

  test('assignStaff throws 409 ALREADY_ASSIGNED on duplicate assignment', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async () => {
        const error = new Error('Conditional check failed');
        error.name = 'ConditionalCheckFailedException';
        throw error;
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new StaffRepository(mockDocClient);
    await assert.rejects(
      async () => {
        await repo.assignStaff(sampleStaff);
      },
      (err: any) => {
        assert.equal(err instanceof ConflictError, true);
        assert.equal(err.code, 'ALREADY_ASSIGNED');
        assert.equal(err.statusCode, 409);
        return true;
      }
    );
  });

  test('revokeStaff deletes item with existence condition', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new StaffRepository(mockDocClient);
    await repo.revokeStaff('evt-ccl-1', 'usr-coord-1');

    assert.equal(executedCommand.input.TableName, 'MarqueEventStaff');
    assert.equal(executedCommand.input.Key.eventId, 'evt-ccl-1');
    assert.equal(executedCommand.input.Key.userId, 'usr-coord-1');
    assert.match(
      executedCommand.input.ConditionExpression,
      /attribute_exists\(eventId\) AND attribute_exists\(userId\)/
    );
  });

  test('revokeStaff throws 404 STAFF_NOT_FOUND when assignment does not exist', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async () => {
        const error = new Error('Not found');
        error.name = 'ConditionalCheckFailedException';
        throw error;
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new StaffRepository(mockDocClient);
    await assert.rejects(
      async () => {
        await repo.revokeStaff('evt-ccl-1', 'usr-nonexistent');
      },
      (err: any) => {
        assert.equal(err instanceof NotFoundError, true);
        assert.equal(err.code, 'STAFF_NOT_FOUND');
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  test('findAssignedEventsByUser queries user-assigned-events-index GSI', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let executedCommand: any = null;
    const mockDocClient = {
      send: async (cmd: any) => {
        executedCommand = cmd;
        return { Items: [sampleStaff] };
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new StaffRepository(mockDocClient);
    const results = await repo.findAssignedEventsByUser('usr-coord-1');

    assert.equal(results.length, 1);
    assert.equal(executedCommand.input.IndexName, 'user-assigned-events-index');
    assert.equal(executedCommand.input.KeyConditionExpression, 'userId = :userId');
    assert.equal(executedCommand.input.ExpressionAttributeValues[':userId'], 'usr-coord-1');
  });
});
