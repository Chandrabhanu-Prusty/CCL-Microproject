import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { StaffService } from '../services/staff.service.js';
import { jsonResponse, errorResponse } from '../utils/http.js';
import { ValidationError } from '../utils/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { assignStaffSchema } from '../schemas/staff.schema.js';
import type { AuthService } from '../services/auth.service.js';

let defaultStaffService: StaffService | null = null;

function getDefaultStaffService(): StaffService {
  if (!defaultStaffService) {
    defaultStaffService = new StaffService();
  }
  return defaultStaffService;
}

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
 * Handler for listing staff assigned to an event.
 * Endpoint: GET /api/events/{eventId}/staff
 */
export async function listStaffHandler(
  event: APIGatewayProxyEventV2,
  eventId: string,
  service?: StaffService,
  authService?: AuthService
): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;
  try {
    const caller = requireRole(event, 'ORGANIZER', authService);
    const staffService = service ?? getDefaultStaffService();
    const staff = await staffService.listStaff(eventId, caller);
    return jsonResponse(200, { staff }, origin);
  } catch (err) {
    return errorResponse(err, origin);
  }
}

/**
 * Handler for assigning a coordinator to an event.
 * Endpoint: POST /api/events/{eventId}/staff
 */
export async function assignStaffHandler(
  event: APIGatewayProxyEventV2,
  eventId: string,
  service?: StaffService,
  authService?: AuthService
): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;
  try {
    const caller = requireRole(event, 'ORGANIZER', authService);
    const staffService = service ?? getDefaultStaffService();
    const rawBody = parseJsonBody(event.body);
    const parsed = assignStaffSchema.safeParse(rawBody);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError(issue?.message || 'Email validation failed.');
    }

    const assignment = await staffService.assignStaff(eventId, caller, parsed.data.email);
    return jsonResponse(201, { assignment }, origin);
  } catch (err) {
    return errorResponse(err, origin);
  }
}

/**
 * Handler for revoking a coordinator from an event.
 * Endpoint: DELETE /api/events/{eventId}/staff/{userId}
 */
export async function revokeStaffHandler(
  event: APIGatewayProxyEventV2,
  eventId: string,
  userId: string,
  service?: StaffService,
  authService?: AuthService
): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;
  try {
    const caller = requireRole(event, 'ORGANIZER', authService);
    const staffService = service ?? getDefaultStaffService();
    await staffService.revokeStaff(eventId, caller, userId);
    return jsonResponse(200, { message: 'Coordinator assignment successfully revoked.' }, origin);
  } catch (err) {
    return errorResponse(err, origin);
  }
}

/**
 * Handler for listing events assigned to the current authenticated user.
 * Endpoint: GET /api/me/assigned-events
 */
export async function listAssignedEventsHandler(
  event: APIGatewayProxyEventV2,
  service?: StaffService,
  authService?: AuthService
): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;
  try {
    const caller = requireAuth(event, authService);
    const staffService = service ?? getDefaultStaffService();
    const events = await staffService.listAssignedEvents(caller);
    return jsonResponse(200, { events }, origin);
  } catch (err) {
    return errorResponse(err, origin);
  }
}
