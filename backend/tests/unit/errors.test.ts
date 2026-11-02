import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../src/utils/errors.js';

describe('AppError Hierarchy & Mapping', () => {
  test('AppError sets message, code, and status code correctly', () => {
    const err = new AppError(418, 'TEAPOT', 'I am a teapot', { extra: 'detail' });
    assert.equal(err.statusCode, 418);
    assert.equal(err.code, 'TEAPOT');
    assert.equal(err.message, 'I am a teapot');
    assert.deepEqual(err.details, { extra: 'detail' });
    assert.equal(err instanceof Error, true);
    assert.equal(err instanceof AppError, true);
  });

  test('ValidationError defaults to 400 and VALIDATION_ERROR', () => {
    const err = new ValidationError('Invalid email format');
    assert.equal(err.statusCode, 400);
    assert.equal(err.code, 'VALIDATION_ERROR');
    assert.equal(err.message, 'Invalid email format');
  });

  test('UnauthorizedError defaults to 401 and UNAUTHORIZED', () => {
    const err = new UnauthorizedError();
    assert.equal(err.statusCode, 401);
    assert.equal(err.code, 'UNAUTHORIZED');
  });

  test('UnauthorizedError accepts custom code e.g. INVALID_CREDENTIALS', () => {
    const err = new UnauthorizedError('Invalid email or password.', 'INVALID_CREDENTIALS');
    assert.equal(err.statusCode, 401);
    assert.equal(err.code, 'INVALID_CREDENTIALS');
    assert.equal(err.message, 'Invalid email or password.');
  });

  test('ForbiddenError defaults to 403 and FORBIDDEN', () => {
    const err = new ForbiddenError();
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, 'FORBIDDEN');
  });

  test('NotFoundError sets custom error code and 404', () => {
    const err = new NotFoundError('EVENT_NOT_FOUND', 'Event evt-123 does not exist');
    assert.equal(err.statusCode, 404);
    assert.equal(err.code, 'EVENT_NOT_FOUND');
  });

  test('ConflictError sets custom conflict code and 409', () => {
    const err = new ConflictError('DUPLICATE_REGISTRATION', 'User already registered');
    assert.equal(err.statusCode, 409);
    assert.equal(err.code, 'DUPLICATE_REGISTRATION');
  });
});

