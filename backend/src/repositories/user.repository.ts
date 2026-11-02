import {
  GetCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { getDynamoDB } from '../config/aws.js';
import { getEnv } from '../config/env.js';
import type { UserProfile, UserLockItem, BootstrapLockItem } from '../types/auth.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';

export class UserRepository {
  private docClient: DynamoDBDocumentClient | null = null;

  constructor(docClient?: DynamoDBDocumentClient) {
    if (docClient) {
      this.docClient = docClient;
    }
  }

  private getClient(): DynamoDBDocumentClient {
    if (!this.docClient) {
      this.docClient = getDynamoDB();
    }
    return this.docClient;
  }

  private get tableName(): string {
    return getEnv().USERS_TABLE;
  }

  /**
   * Atomically creates a user profile and email lock item in MarqueUsers.
   * If the email is already registered, the lock condition fails and rolls back atomically.
   */
  async createWithEmailLock(user: {
    userId: string;
    name: string;
    email: string;
    normalizedEmail: string;
    passwordHash: string;
    role: 'ATTENDEE';
  }): Promise<UserProfile> {
    const now = new Date().toISOString();

    const profileItem: UserProfile = {
      userId: user.userId,
      itemType: 'PROFILE',
      name: user.name,
      email: user.email,
      normalizedEmail: user.normalizedEmail,
      passwordHash: user.passwordHash,
      role: 'ATTENDEE',
      createdAt: now,
      updatedAt: now,
    };

    const lockItem: UserLockItem = {
      userId: `EMAIL#${user.normalizedEmail}`,
      itemType: 'LOCK',
      ownerUserId: user.userId,
      createdAt: now,
    };

    try {
      await this.getClient().send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: profileItem,
                ConditionExpression: 'attribute_not_exists(userId)',
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: lockItem,
                ConditionExpression: 'attribute_not_exists(userId)',
              },
            },
          ],
        })
      );

      return profileItem;
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        err.name === 'TransactionCanceledException'
      ) {
        // Atomic transaction cancelled because EMAIL#<normalizedEmail> lock item already exists
        throw new ConflictError(
          'EMAIL_ALREADY_EXISTS',
          'An account with this email address already exists.'
        );
      }
      throw err;
    }
  }

  /**
   * Performs a 2-step strongly consistent lookup:
   * 1. Get Lock item via EMAIL#<normalizedEmail> to extract ownerUserId.
   * 2. Get Profile item via ownerUserId.
   */
  async findByNormalizedEmail(normalizedEmail: string): Promise<UserProfile | null> {
    // Step 1: Read lock item
    const lockResult = await this.getClient().send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          userId: `EMAIL#${normalizedEmail}`,
          itemType: 'LOCK',
        },
        ConsistentRead: true,
      })
    );

    const lockItem = lockResult.Item as UserLockItem | undefined;
    if (!lockItem || !lockItem.ownerUserId) {
      return null;
    }

    // Step 2: Read profile item
    return this.findById(lockItem.ownerUserId);
  }

  /**
   * Fetches user profile by userId using strongly consistent read.
   */
  async findById(userId: string): Promise<UserProfile | null> {
    const profileResult = await this.getClient().send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          userId,
          itemType: 'PROFILE',
        },
        ConsistentRead: true,
      })
    );

    const profile = profileResult.Item as UserProfile | undefined;
    return profile ?? null;
  }

  /**
   * Checks whether the one-time bootstrap lock item already exists.
   */
  async getBootstrapLock(): Promise<BootstrapLockItem | null> {
    const result = await this.getClient().send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          userId: 'BOOTSTRAP#ORGANIZER',
          itemType: 'LOCK',
        },
        ConsistentRead: true,
      })
    );
    return (result.Item as BootstrapLockItem) ?? null;
  }

  /**
   * Executes atomic organizer bootstrap:
   * 1. Inserts BOOTSTRAP#ORGANIZER lock item with attribute_not_exists(userId).
   * 2. Updates user profile role from ATTENDEE to ORGANIZER with attribute_exists(userId) AND role = ATTENDEE.
   */
  async executeBootstrapPromotion(targetUserId: string, targetEmail: string): Promise<void> {
    const now = new Date().toISOString();

    const bootstrapLock: BootstrapLockItem = {
      userId: 'BOOTSTRAP#ORGANIZER',
      itemType: 'LOCK',
      promotedUserId: targetUserId,
      promotedEmail: targetEmail,
      createdAt: now,
    };

    try {
      await this.getClient().send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: bootstrapLock,
                ConditionExpression: 'attribute_not_exists(userId)',
              },
            },
            {
              Update: {
                TableName: this.tableName,
                Key: {
                  userId: targetUserId,
                  itemType: 'PROFILE',
                },
                UpdateExpression: 'SET #role = :organizer, updatedAt = :now',
                ConditionExpression: 'attribute_exists(userId) AND #role = :attendee',
                ExpressionAttributeNames: {
                  '#role': 'role',
                },
                ExpressionAttributeValues: {
                  ':organizer': 'ORGANIZER',
                  ':attendee': 'ATTENDEE',
                  ':now': now,
                },
              },
            },
          ],
        })
      );
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        err.name === 'TransactionCanceledException'
      ) {
        const txError = err as { CancellationReasons?: Array<{ Code?: string }> };
        const reasons = txError.CancellationReasons;

        if (reasons && reasons[0]?.Code === 'ConditionalCheckFailed') {
          throw new ConflictError(
            'BOOTSTRAP_ALREADY_COMPLETED',
            'Organizer bootstrap has already been executed. Only one organizer can be provisioned through this mechanism.'
          );
        }

        if (reasons && reasons[1]?.Code === 'ConditionalCheckFailed') {
          throw new NotFoundError(
            'USER_NOT_ELIGIBLE',
            'Target account does not exist or is not eligible for organizer promotion.'
          );
        }

        throw new ConflictError(
          'BOOTSTRAP_CONFLICT',
          'Organizer bootstrap transaction failed due to a concurrent conflict.'
        );
      }
      throw err;
    }
  }
}
