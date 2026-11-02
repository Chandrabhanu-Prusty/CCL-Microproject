import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ConflictError } from '../../src/utils/errors.js';
import { errorResponse, jsonResponse, optionsResponse } from '../../src/utils/http.js';
import { resetEnvCache, getEnv } from '../../src/config/env.js';

describe('HTTP Response Builders', () => {
  const testEnv = {
    USERS_TABLE: 'MarqueUsers',
    EVENTS_TABLE: 'MarqueEvents',
    EVENT_STAFF_TABLE: 'MarqueEventStaff',
    RSVPS_TABLE: 'MarqueRSVPs',
    WAITLIST_TABLE: 'MarqueWaitlist',
    TICKETS_TABLE: 'MarqueTickets',
    S3_BUCKET: 'actual-s3-bucket-name',
    JWT_SECRET: 'super-secret-key-that-is-at-least-32-chars-long',
    CORS_ALLOWED_ORIGINS: 'http://localhost:5173,https://*.vercel.app',
  };

  test('errorResponse maps AppError to standard JSON error envelope and status code', () => {
    resetEnvCache();
    getEnv(testEnv);
    const res = errorResponse(
      new ConflictError('DUPLICATE_REGISTRATION', 'Already registered for this event.', { eventId: 'evt-1' }),
      'http://localhost:5173'
    );
    assert.equal(res.statusCode, 409);
    assert.equal(res.headers['Content-Type'], 'application/json');
    assert.equal(res.headers['Access-Control-Allow-Origin'], 'http://localhost:5173');
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, 'DUPLICATE_REGISTRATION');
    assert.equal(body.error.message, 'Already registered for this event.');
    assert.deepEqual(body.error.details, { eventId: 'evt-1' });
  });

  test('errorResponse handles unhandled generic error with 500 INTERNAL_SERVER_ERROR', () => {
    resetEnvCache();
    getEnv(testEnv);
    const res = errorResponse(new Error('Unexpected database failure'));
    assert.equal(res.statusCode, 500);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, 'INTERNAL_SERVER_ERROR');
    assert.equal(body.error.message, 'An unexpected internal error occurred.');
  });

  test('jsonResponse formats payload with 200 OK and JSON headers', () => {
    resetEnvCache();
    getEnv(testEnv);
    const res = jsonResponse(200, { message: 'success' }, 'http://localhost:5173');
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'application/json');
    assert.equal(res.headers['Access-Control-Allow-Origin'], 'http://localhost:5173');
    assert.deepEqual(JSON.parse(res.body), { message: 'success' });
  });

  test('optionsResponse returns 204 with CORS preflight headers and empty body', () => {
    resetEnvCache();
    getEnv(testEnv);
    const res = optionsResponse('http://localhost:5173');
    assert.equal(res.statusCode, 204);
    assert.equal(res.headers['Access-Control-Allow-Origin'], 'http://localhost:5173');
    assert.equal(res.headers['Access-Control-Allow-Methods'], 'GET, POST, PATCH, DELETE, OPTIONS');
    assert.equal(res.body, '');
  });
});

