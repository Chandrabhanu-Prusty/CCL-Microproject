import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../../src/index.js';
import { resetEnvCache, getEnv } from '../../src/config/env.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

describe('Lambda Handler Entry-point Skeleton', () => {
  const testEnv = {
    USERS_TABLE: 'MarqueUsers',
    EVENTS_TABLE: 'MarqueEvents',
    EVENT_STAFF_TABLE: 'MarqueEventStaff',
    RSVPS_TABLE: 'MarqueRSVPs',
    WAITLIST_TABLE: 'MarqueWaitlist',
    TICKETS_TABLE: 'MarqueTickets',
    S3_BUCKET: 'actual-s3-bucket-name',
    JWT_SECRET: 'super-secret-key-that-is-at-least-32-chars-long',
    CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
  };

  test('responds to OPTIONS preflight with 204 No Content', async () => {
    resetEnvCache();
    getEnv(testEnv);
    const event = {
      rawPath: '/api/events',
      requestContext: { http: { method: 'OPTIONS' } },
      headers: { origin: 'http://localhost:5173' },
    } as unknown as APIGatewayProxyEventV2;

    const res = await handler(event) as any;
    assert.equal(res.statusCode, 204);
    assert.equal(res.headers['Access-Control-Allow-Origin'], 'http://localhost:5173');
  });

  test('responds to GET /health with 200 OK and healthy status', async () => {
    resetEnvCache();
    getEnv(testEnv);
    const event = {
      rawPath: '/health',
      requestContext: { http: { method: 'GET' } },
      headers: { origin: 'http://localhost:5173' },
    } as unknown as APIGatewayProxyEventV2;

    const res = await handler(event) as any;
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'healthy');
  });

  test('returns 404 ROUTE_NOT_FOUND on unmatched routes', async () => {
    resetEnvCache();
    getEnv(testEnv);
    const event = {
      rawPath: '/unmatched-route',
      requestContext: { http: { method: 'GET' } },
      headers: { origin: 'http://localhost:5173' },
    } as unknown as APIGatewayProxyEventV2;

    const res = await handler(event) as any;
    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, 'ROUTE_NOT_FOUND');
  });

  test('direct bootstrap event rejects when BOOTSTRAP_SECRET is absent in env', async () => {
    resetEnvCache();
    getEnv(testEnv); // no BOOTSTRAP_SECRET
    const directEvent = {
      action: 'BOOTSTRAP_ORGANIZER',
      email: 'lead@vesit.edu',
      secret: 'any-secret',
    } as const;

    const res = await handler(directEvent) as any;
    assert.equal(res.statusCode, 403);
    assert.equal(res.error, 'BOOTSTRAP_DISABLED');
  });

  test('direct bootstrap event rejects when BOOTSTRAP_SECRET is empty string ("")', async () => {
    resetEnvCache();
    getEnv({ ...testEnv, BOOTSTRAP_SECRET: '' });
    const directEvent = {
      action: 'BOOTSTRAP_ORGANIZER',
      email: 'lead@vesit.edu',
      secret: 'any-secret',
    } as const;

    const res = await handler(directEvent) as any;
    assert.equal(res.statusCode, 403);
    assert.equal(res.error, 'BOOTSTRAP_DISABLED');

    // Normal application routes continue operating normally
    const healthEvent = {
      rawPath: '/health',
      requestContext: { http: { method: 'GET' } },
      headers: { origin: 'http://localhost:5173' },
    } as unknown as APIGatewayProxyEventV2;
    const healthRes = await handler(healthEvent) as any;
    assert.equal(healthRes.statusCode, 200);
  });

  test('direct bootstrap event rejects when secret does not match', async () => {
    resetEnvCache();
    getEnv({ ...testEnv, BOOTSTRAP_SECRET: 'configured-secret-16' });
    const directEvent = {
      action: 'BOOTSTRAP_ORGANIZER',
      email: 'lead@vesit.edu',
      secret: 'wrong-secret-12345',
    } as const;

    const res = await handler(directEvent) as any;
    assert.equal(res.statusCode, 403);
    assert.equal(res.error, 'INVALID_BOOTSTRAP_SECRET');
  });

  test('direct bootstrap event authorizes when secret matches', async () => {
    resetEnvCache();
    getEnv({ ...testEnv, BOOTSTRAP_SECRET: 'configured-secret-16' });
    const directEvent = {
      action: 'BOOTSTRAP_ORGANIZER',
      email: 'lead@vesit.edu',
      secret: 'configured-secret-16',
    } as const;

    const mockAuthService = {
      bootstrapOrganizer: async (email: string) => ({
        success: true,
        promotedUserId: 'usr-promoted-01',
        email,
        role: 'ORGANIZER' as const,
        message: 'Organizer bootstrap successfully executed.',
      }),
    } as any;

    const res = await handler(directEvent, mockAuthService) as any;
    assert.equal(res.statusCode, 200);
    assert.equal(res.role, 'ORGANIZER');
  });

  test('HTTP API event with action: BOOTSTRAP_ORGANIZER cannot trigger bootstrap and returns 404', async () => {
    resetEnvCache();
    getEnv({ ...testEnv, BOOTSTRAP_SECRET: 'configured-secret-16' });

    // HTTP event that attempts to masquerade with action: BOOTSTRAP_ORGANIZER
    const httpEvent = {
      rawPath: '/api/auth/bootstrap',
      requestContext: { http: { method: 'POST' } },
      headers: { origin: 'http://localhost:5173' },
      body: JSON.stringify({
        action: 'BOOTSTRAP_ORGANIZER',
        email: 'lead@vesit.edu',
        secret: 'configured-secret-16',
      }),
      action: 'BOOTSTRAP_ORGANIZER', // even if injected into event
    } as unknown as APIGatewayProxyEventV2;

    const res = await handler(httpEvent) as any;
    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, 'ROUTE_NOT_FOUND');
  });
});
