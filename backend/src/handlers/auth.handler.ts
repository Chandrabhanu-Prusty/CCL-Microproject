import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { AuthService } from '../services/auth.service.js';
import { jsonResponse, errorResponse } from '../utils/http.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';
import { registerSchema, loginSchema, bootstrapSchema } from '../schemas/auth.schema.js';
import type { DirectBootstrapEvent } from '../types/common.js';
import type { TokenPayload } from '../types/auth.js';

let defaultAuthService: AuthService | null = null;

function getDefaultAuthService(): AuthService {
  if (!defaultAuthService) {
    defaultAuthService = new AuthService();
  }
  return defaultAuthService;
}

/**
 * Extracts and verifies the Bearer JWT token from the incoming event.
 */
export function extractAuthUser(
  event: APIGatewayProxyEventV2,
  service?: AuthService
): TokenPayload {
  const authServiceInstance = service ?? getDefaultAuthService();
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header.');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new UnauthorizedError('Bearer token is empty.');
  }

  return authServiceInstance.verifyToken(token);
}

/**
 * Parses and validates JSON payload from an event.
 */
function parseJsonBody(body: string | undefined): unknown {
  if (!body) {
    throw new ValidationError('Request body is required.');
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new ValidationError('Malformed JSON in request body.');
  }
}

/**
 * Public User Registration Handler.
 * Always assigns ATTENDEE role.
 */
export async function registerHandler(
  event: APIGatewayProxyEventV2,
  service?: AuthService
): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;
  try {
    const authServiceInstance = service ?? getDefaultAuthService();
    const rawBody = parseJsonBody(event.body);
    const parsed = registerSchema.safeParse(rawBody);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError(issue?.message || 'Validation failed.');
    }

    const result = await authServiceInstance.register(parsed.data);
    return jsonResponse(201, result, origin);
  } catch (err) {
    return errorResponse(err, origin);
  }
}

/**
 * Public User Login Handler.
 */
export async function loginHandler(
  event: APIGatewayProxyEventV2,
  service?: AuthService
): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;
  try {
    const authServiceInstance = service ?? getDefaultAuthService();
    const rawBody = parseJsonBody(event.body);
    const parsed = loginSchema.safeParse(rawBody);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError(issue?.message || 'Validation failed.');
    }

    const result = await authServiceInstance.login(parsed.data);
    return jsonResponse(200, result, origin);
  } catch (err) {
    return errorResponse(err, origin);
  }
}

/**
 * Authenticated User Profile Handler (/api/auth/me).
 */
export async function meHandler(
  event: APIGatewayProxyEventV2,
  service?: AuthService
): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;
  try {
    const authServiceInstance = service ?? getDefaultAuthService();
    const caller = extractAuthUser(event, authServiceInstance);
    const user = await authServiceInstance.getProfile(caller.userId);
    return jsonResponse(200, { user }, origin);
  } catch (err) {
    return errorResponse(err, origin);
  }
}

/**
 * One-time direct Lambda organizer bootstrap handler.
 * Triggered only through direct invocation (never via public HTTP route).
 */
export async function bootstrapHandler(
  event: DirectBootstrapEvent,
  service?: AuthService
): Promise<Record<string, unknown>> {
  try {
    const authServiceInstance = service ?? getDefaultAuthService();
    const parsed = bootstrapSchema.safeParse({
      email: event.email,
      secret: event.secret,
    });

    if (!parsed.success) {
      return {
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message || 'Invalid bootstrap event payload.',
      };
    }

    const result = await authServiceInstance.bootstrapOrganizer(parsed.data.email, parsed.data.secret);
    return {
      statusCode: 200,
      ...result,
    };
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'statusCode' in err &&
      'code' in err &&
      'message' in err
    ) {
      const appErr = err as { statusCode: number; code: string; message: string };
      return {
        statusCode: appErr.statusCode,
        error: appErr.code,
        message: appErr.message,
      };
    }

    return {
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred during organizer bootstrap.',
    };
  }
}
