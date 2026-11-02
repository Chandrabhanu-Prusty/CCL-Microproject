import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { AuthService } from '../services/auth.service.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import type { TokenPayload, UserRole } from '../types/auth.js';

let defaultAuthService: AuthService | null = null;

function getDefaultAuthService(): AuthService {
  if (!defaultAuthService) {
    defaultAuthService = new AuthService();
  }
  return defaultAuthService;
}

/**
 * Extracts and verifies the Bearer JWT token from an incoming API Gateway HTTP event.
 * Rejects missing, malformed, expired, or invalid tokens with HTTP 401 UNAUTHORIZED.
 */
export function requireAuth(
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
 * Verifies Bearer JWT and checks that the authenticated user possesses the required role.
 * Throws 403 FORBIDDEN if the caller's role does not match.
 */
export function requireRole(
  event: APIGatewayProxyEventV2,
  requiredRole: UserRole,
  service?: AuthService
): TokenPayload {
  const caller = requireAuth(event, service);
  if (caller.role !== requiredRole) {
    throw new ForbiddenError(`Access forbidden. Requires ${requiredRole} role.`);
  }
  return caller;
}

/**
 * Optional authentication extractor.
 * If Authorization header is present, verifies token and returns TokenPayload.
 * If absent, returns null without throwing an error.
 */
export function optionalAuth(
  event: APIGatewayProxyEventV2,
  service?: AuthService
): TokenPayload | null {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader) {
    return null;
  }
  return requireAuth(event, service);
}
