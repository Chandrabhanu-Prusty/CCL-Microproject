import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCorsHeaders, isOriginAllowed } from '../../src/utils/cors.js';

describe('Configurable Multi-Origin CORS Resolver (Isolated)', () => {
  const allowedConfig = 'http://localhost:5173,http://localhost:3000,https://*.vercel.app';

  test('allows exact localhost origin', () => {
    const headers = resolveCorsHeaders('http://localhost:5173', allowedConfig);
    assert.equal(headers['Access-Control-Allow-Origin'], 'http://localhost:5173');
    assert.equal(headers['Access-Control-Allow-Credentials'], 'true');
  });

  test('allows matching valid single-level Vercel subdomain', () => {
    const headers = resolveCorsHeaders('https://ccl-marque.vercel.app', allowedConfig);
    assert.equal(headers['Access-Control-Allow-Origin'], 'https://ccl-marque.vercel.app');
    assert.equal(headers['Access-Control-Allow-Credentials'], 'true');
  });

  test('does NOT return Access-Control-Allow-Origin for unrecognized origin', () => {
    const headers = resolveCorsHeaders('https://malicious-site.com', allowedConfig);
    assert.equal(headers['Access-Control-Allow-Origin'], undefined);
  });

  test('does NOT return Access-Control-Allow-Origin when requestOrigin is undefined', () => {
    const headers = resolveCorsHeaders(undefined, allowedConfig);
    assert.equal(headers['Access-Control-Allow-Origin'], undefined);
  });

  test('isOriginAllowed accepts valid single-level Vercel subdomains', () => {
    assert.equal(isOriginAllowed('https://preview-12.vercel.app', 'https://*.vercel.app'), true);
    assert.equal(isOriginAllowed('https://ccl-microproject.vercel.app', 'https://*.vercel.app'), true);
    assert.equal(isOriginAllowed('https://a.vercel.app', 'https://*.vercel.app'), true);
    assert.equal(isOriginAllowed('https://my-app-123.vercel.app', 'https://*.vercel.app'), true);
  });

  test('isOriginAllowed rejects non-HTTPS vercel origins', () => {
    assert.equal(isOriginAllowed('http://ccl-microproject.vercel.app', 'https://*.vercel.app'), false);
    assert.equal(isOriginAllowed('http://insecure.vercel.app', 'https://*.vercel.app'), false);
  });

  test('isOriginAllowed rejects custom ports on vercel origins', () => {
    assert.equal(isOriginAllowed('https://ccl-microproject.vercel.app:8080', 'https://*.vercel.app'), false);
    assert.equal(isOriginAllowed('https://ccl-microproject.vercel.app:443', 'https://*.vercel.app'), false);
    assert.equal(isOriginAllowed('https://ccl-microproject.vercel.app:3000', 'https://*.vercel.app'), false);
  });

  test('isOriginAllowed rejects paths and trailing slashes on vercel origins', () => {
    assert.equal(isOriginAllowed('https://ccl-microproject.vercel.app/', 'https://*.vercel.app'), false);
    assert.equal(isOriginAllowed('https://ccl-microproject.vercel.app/events', 'https://*.vercel.app'), false);
  });

  test('isOriginAllowed rejects nested subdomains on vercel origins', () => {
    assert.equal(isOriginAllowed('https://sub.ccl-microproject.vercel.app', 'https://*.vercel.app'), false);
    assert.equal(isOriginAllowed('https://a.b.c.vercel.app', 'https://*.vercel.app'), false);
  });

  test('isOriginAllowed rejects malformed hostnames and deceptive domains', () => {
    assert.equal(isOriginAllowed('https://-invalid.vercel.app', 'https://*.vercel.app'), false);
    assert.equal(isOriginAllowed('https://invalid-.vercel.app', 'https://*.vercel.app'), false);
    assert.equal(isOriginAllowed('https://ccl_microproject.vercel.app', 'https://*.vercel.app'), false);
    assert.equal(isOriginAllowed('https://notvercel.app', 'https://*.vercel.app'), false);
    assert.equal(isOriginAllowed('https://ccl-microproject.vercel.app.attacker.com', 'https://*.vercel.app'), false);
  });
});
