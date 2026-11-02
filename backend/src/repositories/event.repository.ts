import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
  type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { getDynamoDB } from '../config/aws.js';
import { getEnv } from '../config/env.js';
import type { EventItem } from '../types/event.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';

export class EventRepository {
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
    return getEnv().EVENTS_TABLE;
  }

  /**
   * Creates a new event record in MarqueEvents.
   */
  async create(event: EventItem): Promise<EventItem> {
    try {
      await this.getClient().send(
        new PutCommand({
          TableName: this.tableName,
          Item: event,
          ConditionExpression: 'attribute_not_exists(eventId)',
        })
      );
      return event;
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        err.name === 'ConditionalCheckFailedException'
      ) {
        throw new ConflictError('EVENT_ALREADY_EXISTS', 'An event with this ID already exists.');
      }
      throw err;
    }
  }

  /**
   * Retrieves an event by eventId with strongly consistent read.
   */
  async findById(eventId: string): Promise<EventItem | null> {
    const result = await this.getClient().send(
      new GetCommand({
        TableName: this.tableName,
        Key: { eventId },
        ConsistentRead: true,
      })
    );
    return (result.Item as EventItem) ?? null;
  }

  /**
   * Queries published events using the status-startAt-index GSI.
   * Never uses DynamoDB Scan.
   */
  async findPublished(category?: string): Promise<EventItem[]> {
    const queryInput: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'status-startAt-index',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'PUBLISHED',
      },
      ScanIndexForward: true, // Chronological schedule order
    };

    if (category) {
      queryInput.FilterExpression = '#category = :category';
      queryInput.ExpressionAttributeNames!['#category'] = 'category';
      queryInput.ExpressionAttributeValues![':category'] = category;
    }

    const result = await this.getClient().send(new QueryCommand(queryInput));
    return (result.Items as EventItem[]) ?? [];
  }

  /**
   * Queries events owned by a specific organizer using organizer-index GSI.
   */
  async findByOrganizer(organizerId: string): Promise<EventItem[]> {
    const result = await this.getClient().send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'organizer-index',
        KeyConditionExpression: 'organizerId = :organizerId',
        ExpressionAttributeValues: {
          ':organizerId': organizerId,
        },
        ScanIndexForward: false, // Newest first
      })
    );
    return (result.Items as EventItem[]) ?? [];
  }

  /**
   * Updates an existing event atomically with conditional expressions protecting ownership.
   */
  async update(
    eventId: string,
    organizerId: string,
    updates: Partial<EventItem>
  ): Promise<EventItem> {
    const now = new Date().toISOString();
    const updateKeys = Object.keys(updates).filter(
      (k) => k !== 'eventId' && k !== 'organizerId' && k !== 'createdAt' && updates[k as keyof EventItem] !== undefined
    ) as Array<keyof EventItem>;

    if (updateKeys.length === 0) {
      const existing = await this.findById(eventId);
      if (!existing) {
        throw new NotFoundError('EVENT_NOT_FOUND', 'Event not found.');
      }
      return existing;
    }

    const expressionParts: string[] = ['#updatedAt = :updatedAt'];
    const expressionAttributeNames: Record<string, string> = {
      '#updatedAt': 'updatedAt',
      '#organizerId': 'organizerId',
    };
    const expressionAttributeValues: Record<string, unknown> = {
      ':updatedAt': now,
      ':organizerId': organizerId,
    };

    for (const key of updateKeys) {
      const attrName = `#attr_${key}`;
      const attrVal = `:val_${key}`;
      expressionParts.push(`${attrName} = ${attrVal}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrVal] = updates[key];
    }

    let conditionExpression = 'attribute_exists(eventId) AND #organizerId = :organizerId';

    // If capacity is being updated, enforce that capacity cannot drop below current confirmedCount
    if (updates.capacity !== undefined) {
      conditionExpression += ' AND confirmedCount <= :newCapacity';
      expressionAttributeValues[':newCapacity'] = updates.capacity;
    }

    try {
      const result = await this.getClient().send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { eventId },
          UpdateExpression: `SET ${expressionParts.join(', ')}`,
          ConditionExpression: conditionExpression,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW',
        })
      );
      return result.Attributes as EventItem;
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        err.name === 'ConditionalCheckFailedException'
      ) {
        // Inspect whether event exists and whether caller is owner
        const existing = await this.findById(eventId);
        if (!existing) {
          throw new NotFoundError('EVENT_NOT_FOUND', 'Event not found.');
        }
        if (existing.organizerId !== organizerId) {
          throw new ConflictError('FORBIDDEN', 'Access forbidden. You do not own this event.');
        }
        if (updates.capacity !== undefined && existing.confirmedCount > updates.capacity) {
          throw new ConflictError(
            'INVALID_CAPACITY',
            'Requested capacity is less than existing confirmed attendees.'
          );
        }
      }
      throw err;
    }
  }
}
