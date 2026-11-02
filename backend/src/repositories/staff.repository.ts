import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { getDynamoDB } from '../config/aws.js';
import { getEnv } from '../config/env.js';
import type { EventStaffRecord } from '../types/staff.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';

export class StaffRepository {
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
    return getEnv().EVENT_STAFF_TABLE;
  }

  /**
   * Retrieves all staff assigned to a given event.
   */
  async findStaffByEvent(eventId: string): Promise<EventStaffRecord[]> {
    const result = await this.getClient().send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'eventId = :eventId',
        ExpressionAttributeValues: {
          ':eventId': eventId,
        },
      })
    );
    return (result.Items as EventStaffRecord[]) ?? [];
  }

  /**
   * Retrieves a specific staff assignment by eventId and userId.
   */
  async findStaffMember(eventId: string, userId: string): Promise<EventStaffRecord | null> {
    const result = await this.getClient().send(
      new GetCommand({
        TableName: this.tableName,
        Key: { eventId, userId },
        ConsistentRead: true,
      })
    );
    return (result.Item as EventStaffRecord) ?? null;
  }

  /**
   * Assigns a user as check-in staff for an event.
   * Atomically prevents duplicate active assignments.
   */
  async assignStaff(staff: EventStaffRecord): Promise<EventStaffRecord> {
    try {
      await this.getClient().send(
        new PutCommand({
          TableName: this.tableName,
          Item: staff,
          ConditionExpression: 'attribute_not_exists(eventId) AND attribute_not_exists(userId)',
        })
      );
      return staff;
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        err.name === 'ConditionalCheckFailedException'
      ) {
        throw new ConflictError(
          'ALREADY_ASSIGNED',
          'User is already an active coordinator for this event.'
        );
      }
      throw err;
    }
  }

  /**
   * Revokes staff assignment for an event.
   */
  async revokeStaff(eventId: string, userId: string): Promise<void> {
    try {
      await this.getClient().send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { eventId, userId },
          ConditionExpression: 'attribute_exists(eventId) AND attribute_exists(userId)',
        })
      );
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        err.name === 'ConditionalCheckFailedException'
      ) {
        throw new NotFoundError(
          'STAFF_NOT_FOUND',
          'Coordinator assignment not found for this event.'
        );
      }
      throw err;
    }
  }

  /**
   * Queries events assigned to a specific user using user-assigned-events-index GSI.
   */
  async findAssignedEventsByUser(userId: string): Promise<EventStaffRecord[]> {
    const result = await this.getClient().send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'user-assigned-events-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
      })
    );
    return (result.Items as EventStaffRecord[]) ?? [];
  }
}
