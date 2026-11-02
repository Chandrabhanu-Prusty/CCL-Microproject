import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

export interface StandardErrorPayload {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T = unknown> = APIGatewayProxyStructuredResultV2 & {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

export interface AuthUserContext {
  userId: string;
  email: string;
  role: 'ATTENDEE' | 'ORGANIZER';
}

export interface DirectBootstrapEvent {
  action: 'BOOTSTRAP_ORGANIZER';
  email: string;
  secret: string;
}

