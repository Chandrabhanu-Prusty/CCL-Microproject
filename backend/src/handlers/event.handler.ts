import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { EventService } from '../services/event.service.js';
import { jsonResponse, errorResponse } from '../utils/http.js';
import { ValidationError } from '../utils/errors.js';
import { requireRole } from '../middleware/auth.middleware.js';
import { createEventSchema, updateEventSchema } from '../schemas/event.schema.js';
import type { AuthService } from '../services/auth.service.js';

let defaultEventService: EventService | null = null;

function getDefaultEventService(): EventService {
  if (!defaultEventService) {
    defaultEventService = new EventService();
  }
  return defaultEventService;
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
 * Public handler for listing published events with optional filtering.
 */
export async function listEventsHandler(
  event: APIGatewayProxyEventV2,
  service?: EventService
): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;
  try {
    const eventService = service ?? getDefaultEventService();
    const query = event.queryStringParameters || {};
    const events = await eventService.listEvents({
      q: query.q,
      category: query.category,
    });
    return jsonResponse(200, { events }, origin);
  } catch (err) {
    return errorResponse(err, origin);
  }
}

/**
 * Public handler for retrieving a single event by ID.
 */
export async function getEventHandler(
  event: APIGatewayProxyEventV2,
  eventId: string,
  service?: EventService
): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;
  try {
    const eventService = service ?? getDefaultEventService();
    const eventItem = await eventService.getEventById(eventId);
    return jsonResponse(200, { event: eventItem }, origin);
  } catch (err) {
    return errorResponse(err, origin);
  }
}

/**
 * Organizer-only handler for creating a new campus event.
 */
export async function createEventHandler(
  event: APIGatewayProxyEventV2,
  service?: EventService,
  authService?: AuthService
): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;
  try {
    const caller = requireRole(event, 'ORGANIZER', authService);
    const eventService = service ?? getDefaultEventService();
    const rawBody = parseJsonBody(event.body);
    const parsed = createEventSchema.safeParse(rawBody);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError(issue?.message || 'Event validation failed.');
    }

    const createdEvent = await eventService.createEvent(caller.userId, parsed.data);
    return jsonResponse(201, { event: createdEvent }, origin);
  } catch (err) {
    return errorResponse(err, origin);
  }
}

/**
 * Organizer-only & event-owner handler for updating an event.
 */
export async function updateEventHandler(
  event: APIGatewayProxyEventV2,
  eventId: string,
  service?: EventService,
  authService?: AuthService
): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;
  try {
    const caller = requireRole(event, 'ORGANIZER', authService);
    const eventService = service ?? getDefaultEventService();
    const rawBody = parseJsonBody(event.body);
    const parsed = updateEventSchema.safeParse(rawBody);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError(issue?.message || 'Event update validation failed.');
    }

    const updatedEvent = await eventService.updateEvent(eventId, caller.userId, parsed.data);
    return jsonResponse(200, { event: updatedEvent }, origin);
  } catch (err) {
    return errorResponse(err, origin);
  }
}
