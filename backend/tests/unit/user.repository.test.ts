import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { UserRepository } from '../../src/repositories/user.repository.js';
import { getEnv, resetEnvCache } from '../../src/config/env.js';
import { ConflictError, NotFoundError } from '../../src/utils/errors.js';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const testEnv = {
  USERS_TABLE: 'MarqueUsers',
  EVENTS_TABLE: 'MarqueEvents',
  EVENT_STAFF_TABLE: 'MarqueEventStaff',
  RSVPS_TABLE: 'MarqueRSVPs',
  WAITLIST_TABLE: 'MarqueWaitlist',
  TICKETS_TABLE: 'MarqueTickets',
  S3_BUCKET: 'actual-s3-bucket-name',
  JWT_SECRET: 'super-secret-key-that-is-at-least-32-chars-long',
};

describe('UserRepository Unit Tests (Mocked In-Memory DocumentClient)', () => {
  test('createWithEmailLock writes both profile and email lock items atomically', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let capturedCommand: any = null;
    const mockDocClient = {
      send: async (command: any) => {
        capturedCommand = command;
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new UserRepository(mockDocClient);
    const result = await repo.createWithEmailLock({
      userId: 'usr-12345',
      name: 'Chandrabhanu Prusty',
      email: 'student@vesit.edu',
      normalizedEmail: 'student@vesit.edu',
      passwordHash: 'hashed_password_sample',
      role: 'ATTENDEE',
    });

    assert.equal(result.userId, 'usr-12345');
    assert.equal(result.role, 'ATTENDEE');
    assert.equal(result.itemType, 'PROFILE');

    // Verify TransactWriteItems command parameters
    const items = capturedCommand.input.TransactItems;
    assert.equal(items.length, 2);

    // Profile item
    const putProfile = items[0].Put;
    assert.equal(putProfile.TableName, 'MarqueUsers');
    assert.equal(putProfile.Item.userId, 'usr-12345');
    assert.equal(putProfile.Item.itemType, 'PROFILE');
    assert.equal(putProfile.ConditionExpression, 'attribute_not_exists(userId)');

    // Email lock item
    const putLock = items[1].Put;
    assert.equal(putLock.TableName, 'MarqueUsers');
    assert.equal(putLock.Item.userId, 'EMAIL#student@vesit.edu');
    assert.equal(putLock.Item.itemType, 'LOCK');
    assert.equal(putLock.Item.ownerUserId, 'usr-12345');
    assert.equal(putLock.ConditionExpression, 'attribute_not_exists(userId)');
  });

  test('createWithEmailLock throws 409 EMAIL_ALREADY_EXISTS on transaction cancellation', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async () => {
        const error = new Error('Transaction cancelled');
        error.name = 'TransactionCanceledException';
        (error as any).CancellationReasons = [
          { Code: 'None' },
          { Code: 'ConditionalCheckFailed' }, // Lock item collision
        ];
        throw error;
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new UserRepository(mockDocClient);
    await assert.rejects(
      async () => {
        await repo.createWithEmailLock({
          userId: 'usr-12345',
          name: 'Chandrabhanu Prusty',
          email: 'student@vesit.edu',
          normalizedEmail: 'student@vesit.edu',
          passwordHash: 'hashed_password_sample',
          role: 'ATTENDEE',
        });
      },
      (err: any) => {
        assert.equal(err instanceof ConflictError, true);
        assert.equal(err.code, 'EMAIL_ALREADY_EXISTS');
        assert.equal(err.statusCode, 409);
        assert.equal(err.message, 'An account with this email address already exists.');
        return true;
      }
    );
  });

  test('findByNormalizedEmail performs 2-step strongly consistent read', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const calls: any[] = [];
    const mockDocClient = {
      send: async (command: any) => {
        calls.push(command);
        const input = command.input;
        if (input.Key.itemType === 'LOCK') {
          return {
            Item: {
              userId: 'EMAIL#student@vesit.edu',
              itemType: 'LOCK',
              ownerUserId: 'usr-12345',
            },
          };
        }
        if (input.Key.itemType === 'PROFILE') {
          return {
            Item: {
              userId: 'usr-12345',
              itemType: 'PROFILE',
              name: 'Chandrabhanu Prusty',
              email: 'student@vesit.edu',
              role: 'ATTENDEE',
              passwordHash: 'hash',
            },
          };
        }
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new UserRepository(mockDocClient);
    const profile = await repo.findByNormalizedEmail('student@vesit.edu');

    assert.equal(profile !== null, true);
    assert.equal(profile?.userId, 'usr-12345');
    assert.equal(profile?.role, 'ATTENDEE');

    // Verify both calls used ConsistentRead: true
    assert.equal(calls.length, 2);
    assert.equal(calls[0].input.ConsistentRead, true);
    assert.equal(calls[0].input.Key.userId, 'EMAIL#student@vesit.edu');
    assert.equal(calls[1].input.ConsistentRead, true);
    assert.equal(calls[1].input.Key.userId, 'usr-12345');
  });

  test('findByNormalizedEmail returns null when email lock item is absent', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async () => ({ Item: undefined }),
    } as unknown as DynamoDBDocumentClient;

    const repo = new UserRepository(mockDocClient);
    const profile = await repo.findByNormalizedEmail('nonexistent@vesit.edu');
    assert.equal(profile, null);
  });

  test('executeBootstrapPromotion writes bootstrap lock and updates role atomically', async () => {
    resetEnvCache();
    getEnv(testEnv);

    let capturedCommand: any = null;
    const mockDocClient = {
      send: async (command: any) => {
        capturedCommand = command;
        return {};
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new UserRepository(mockDocClient);
    await repo.executeBootstrapPromotion('usr-target-01', 'target@vesit.edu');

    const items = capturedCommand.input.TransactItems;
    assert.equal(items.length, 2);

    // Bootstrap lock item
    const putLock = items[0].Put;
    assert.equal(putLock.TableName, 'MarqueUsers');
    assert.equal(putLock.Item.userId, 'BOOTSTRAP#ORGANIZER');
    assert.equal(putLock.Item.itemType, 'LOCK');
    assert.equal(putLock.Item.promotedUserId, 'usr-target-01');
    assert.equal(putLock.ConditionExpression, 'attribute_not_exists(userId)');

    // Profile update item
    const updateProfile = items[1].Update;
    assert.equal(updateProfile.TableName, 'MarqueUsers');
    assert.equal(updateProfile.Key.userId, 'usr-target-01');
    assert.equal(updateProfile.Key.itemType, 'PROFILE');
    assert.equal(updateProfile.ConditionExpression, 'attribute_exists(userId) AND #role = :attendee');
    assert.equal(updateProfile.UpdateExpression, 'SET #role = :organizer, updatedAt = :now');
  });

  test('executeBootstrapPromotion fails when bootstrap lock already exists', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async () => {
        const error = new Error('Transaction cancelled');
        error.name = 'TransactionCanceledException';
        (error as any).CancellationReasons = [
          { Code: 'ConditionalCheckFailed' }, // Lock item already exists
          { Code: 'None' },
        ];
        throw error;
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new UserRepository(mockDocClient);
    await assert.rejects(
      async () => {
        await repo.executeBootstrapPromotion('usr-target-01', 'target@vesit.edu');
      },
      (err: any) => {
        assert.equal(err instanceof ConflictError, true);
        assert.equal(err.code, 'BOOTSTRAP_ALREADY_COMPLETED');
        assert.equal(err.statusCode, 409);
        return true;
      }
    );
  });

  test('executeBootstrapPromotion fails when target user is not an attendee', async () => {
    resetEnvCache();
    getEnv(testEnv);

    const mockDocClient = {
      send: async () => {
        const error = new Error('Transaction cancelled');
        error.name = 'TransactionCanceledException';
        (error as any).CancellationReasons = [
          { Code: 'None' },
          { Code: 'ConditionalCheckFailed' }, // Target user not attendee or doesn't exist
        ];
        throw error;
      },
    } as unknown as DynamoDBDocumentClient;

    const repo = new UserRepository(mockDocClient);
    await assert.rejects(
      async () => {
        await repo.executeBootstrapPromotion('usr-target-01', 'target@vesit.edu');
      },
      (err: any) => {
        assert.equal(err instanceof NotFoundError, true);
        assert.equal(err.code, 'USER_NOT_ELIGIBLE');
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });
});

