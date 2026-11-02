import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { requireAuth, requireRole, optionalAuth } from '../../src/middleware/auth.middleware.js';
import { AuthService } from '../../src/services/auth.service.js';
import { UnauthorizedError, ForbiddenError } from '../../src/utils/errors.js';
import { resetEnvCache, getEnv } from '../../src/config/env.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

describe('Auth Middleware Unit Tests', () => {
  const testEnv = {
    USERS_TABLE: 'MarqueUsers',
    EVENTS_TABLE: 'MarqueEvents',
    EVENT_STAFF_TABLE: 'MarqueEventStaff',
    RSVPS_TABLE: 'MarqueRSVPs',
    WAITLIST_TABLE: 'MarqueWaitlist',
    TICKETS_TABLE: 'MarqueTickets',
    S3_BUCKET: 'actual-s3-bucket-name',
    JWT_SECRET: 'super-secret-key-that-is-at-least-32-chars-long',
    JWT_EXPIRES_IN: '24h',
  };

  const createEvent = (headers: Record<string, string> = {}): APIGatewayProxyEventV2 => {
    return {
      version: '2.0',
      routeKey: 'GET /api/test',
      rawPath: '/api/test',
      rawQueryString: '',
      headers,
      requestContext: {
        http: { method: 'GET', path: '/api/test', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' },
        accountId: '123456789012',
        apiId: 'api-id',
        domainName: 'localhost',
        domainPrefix: 'localhost',
        requestId: 'req-id',
        routeKey: 'GET /api/test',
        stage: '$default',
        time: '01/Nov/2026:10:00:00 +0000',
        timeEpoch: 1600000000,
      },
      isBase64Encoded: false,
    };
  };

  test('requireAuth rejects missing Authorization header', () => {
    resetEnvCache();
    getEnv(testEnv);
    const event = createEvent();

    assert.throws(
      () => requireAuth(event),
      (err: any) => {
        assert.equal(err instanceof UnauthorizedError, true);
        assert.match(err.message, /Missing or malformed Authorization header/);
        return true;
      }
    );
  });

  test('requireAuth rejects non-Bearer Authorization header', () => {
    resetEnvCache();
    getEnv(testEnv);
    const event = createEvent({ authorization: 'Basic dXNlcjpwYXNz' });

    assert.throws(
      () => requireAuth(event),
      (err: any) => {
        assert.equal(err instanceof UnauthorizedError, true);
        assert.match(err.message, /Missing or malformed Authorization header/);
        return true;
      }
    );
  });

  test('requireAuth rejects empty Bearer token', () => {
    resetEnvCache();
    getEnv(testEnv);
    const event = createEvent({ authorization: 'Bearer    ' });

    assert.throws(
      () => requireAuth(event),
      (err: any) => {
        assert.equal(err instanceof UnauthorizedError, true);
        assert.match(err.message, /Bearer token is empty/);
        return true;
      }
    );
  });

  test('requireAuth rejects forged or invalid token', () => {
    resetEnvCache();
    getEnv(testEnv);
    const forged = jwt.sign(
      { userId: 'usr-1', email: 'forged@vesit.edu', role: 'ATTENDEE' },
      'wrong-secret-key-at-least-32-chars-long'
    );
    const event = createEvent({ authorization: `Bearer ${forged}` });

    assert.throws(
      () => requireAuth(event),
      (err: any) => {
        assert.equal(err instanceof UnauthorizedError, true);
        assert.match(err.message, /Invalid authentication token/);
        return true;
      }
    );
  });

  test('requireAuth returns verified TokenPayload on valid token', () => {
    resetEnvCache();
    getEnv(testEnv);
    const validToken = jwt.sign(
      { userId: 'usr-valid-1', email: 'attendee@vesit.edu', role: 'ATTENDEE' },
      testEnv.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '24h' }
    );
    const event = createEvent({ authorization: `Bearer ${validToken}` });

    const payload = requireAuth(event);
    assert.equal(payload.userId, 'usr-valid-1');
    assert.equal(payload.email, 'attendee@vesit.edu');
    assert.equal(payload.role, 'ATTENDEE');
  });

  test('requireRole rejects when user has insufficient role (ATTENDEE for ORGANIZER route)', () => {
    resetEnvCache();
    getEnv(testEnv);
    const attendeeToken = jwt.sign(
      { userId: 'usr-att-1', email: 'attendee@vesit.edu', role: 'ATTENDEE' },
      testEnv.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '24h' }
    );
    const event = createEvent({ authorization: `Bearer ${attendeeToken}` });

    assert.throws(
      () => requireRole(event, 'ORGANIZER'),
      (err: any) => {
        assert.equal(err instanceof ForbiddenError, true);
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /Requires ORGANIZER role/);
        return true;
      }
    );
  });

  test('requireRole succeeds when user possesses required role', () => {
    resetEnvCache();
    getEnv(testEnv);
    const organizerToken = jwt.sign(
      { userId: 'usr-org-1', email: 'org@vesit.edu', role: 'ORGANIZER' },
      testEnv.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '24h' }
    );
    const event = createEvent({ authorization: `Bearer ${organizerToken}` });

    const payload = requireRole(event, 'ORGANIZER');
    assert.equal(payload.userId, 'usr-org-1');
    assert.equal(payload.role, 'ORGANIZER');
  });

  test('optionalAuth returns null when no Authorization header is present', () => {
    resetEnvCache();
    getEnv(testEnv);
    const event = createEvent();

    const result = optionalAuth(event);
    assert.equal(result, null);
  });

  test('optionalAuth returns verified payload when valid Authorization header is present', () => {
    resetEnvCache();
    getEnv(testEnv);
    const validToken = jwt.sign(
      { userId: 'usr-guest-1', email: 'guest@vesit.edu', role: 'ATTENDEE' },
      testEnv.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '24h' }
    );
    const event = createEvent({ authorization: `Bearer ${validToken}` });

    const result = optionalAuth(event);
    assert.notEqual(result, null);
    assert.equal(result?.userId, 'usr-guest-1');
  });
});
