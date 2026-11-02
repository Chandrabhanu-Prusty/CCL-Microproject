import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { optionsResponse, jsonResponse, errorResponse } from './utils/http.js';
import { NotFoundError } from './utils/errors.js';
import { bootstrapHandler } from './handlers/auth.handler.js';
import type { AuthService } from './services/auth.service.js';
import type { DirectBootstrapEvent } from './types/common.js';

/**
 * Main AWS Lambda handler entry point.
 * Dispatches API Gateway HTTP API v2 proxy events and direct test events.
 */
export async function handler(
  event: APIGatewayProxyEventV2 | DirectBootstrapEvent,
  authService?: AuthService
): Promise<APIGatewayProxyResultV2 | Record<string, unknown>> {
  // 1. Direct Lambda Invocation check (e.g. AWS Console test event for organizer bootstrap)
  // Ensures HTTP API events (which include requestContext) can never reach the bootstrap handler
  if (!('requestContext' in event) && 'action' in event && event.action === 'BOOTSTRAP_ORGANIZER') {
    return bootstrapHandler(event, authService);
  }

  // 2. Standard API Gateway HTTP API v2 Event Processing
  const httpEvent = event as APIGatewayProxyEventV2;
  const origin = httpEvent.headers?.origin || httpEvent.headers?.Origin;
  const method = httpEvent.requestContext?.http?.method || 'GET';
  const path = httpEvent.rawPath || '/';

  // Handle CORS preflight OPTIONS request
  if (method === 'OPTIONS') {
    return optionsResponse(origin);
  }

  try {
    // Health check endpoint
    if (method === 'GET' && (path === '/health' || path === '/api/health')) {
      return jsonResponse(200, { status: 'healthy', timestamp: new Date().toISOString() }, origin);
    }

    // Unmatched routes return 404 (Auth & business routes wired in dedicated routing phase)
    throw new NotFoundError('ROUTE_NOT_FOUND', `Cannot ${method} ${path}`);
  } catch (err) {
    return errorResponse(err, origin);
  }
}
