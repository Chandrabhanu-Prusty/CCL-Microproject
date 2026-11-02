import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { getEnv } from './env.js';

let ddbDocClient: DynamoDBDocumentClient | null = null;
let s3ClientInstance: S3Client | null = null;

/**
 * Returns a singleton DynamoDBDocumentClient configured with the AWS SDK default credential provider chain.
 * No static credentials are used; Lambda assumes the assigned execution role automatically.
 * Note on wrapNumbers: false unmarshals DynamoDB Number (N) attributes as standard JavaScript numbers.
 * Safe integer bounds (up to 2^53 - 1) easily accommodate all Marque counts, timestamps, and capacities.
 */
export function getDynamoDB(): DynamoDBDocumentClient {
  if (!ddbDocClient) {
    const env = getEnv();
    const client = new DynamoDBClient({
      region: env.AWS_REGION,
    });
    ddbDocClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });
  }
  return ddbDocClient;
}

/**
 * Returns a singleton S3Client configured with the AWS SDK default credential provider chain.
 */
export function getS3(): S3Client {
  if (!s3ClientInstance) {
    const env = getEnv();
    s3ClientInstance = new S3Client({
      region: env.AWS_REGION,
    });
  }
  return s3ClientInstance;
}

export function resetAwsClients(): void {
  ddbDocClient = null;
  s3ClientInstance = null;
}
