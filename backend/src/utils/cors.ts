import { getEnv } from '../config/env.js';

/**
 * Validates whether an incoming origin string matches an allowed rule.
 * Supports exact matches (e.g. "http://localhost:5173") and
 * single-level Vercel wildcard matching (e.g. "https://*.vercel.app").
 * Rejects non-HTTPS origins, custom ports, paths, nested subdomains, and invalid hostnames.
 */
export function isOriginAllowed(origin: string, pattern: string): boolean {
  const trimmedPattern = pattern.trim();
  const trimmedOrigin = origin.trim();

  // Exact match
  if (trimmedPattern === trimmedOrigin) {
    return true;
  }

  // Safe single-level Vercel subdomain wildcard pattern: https://*.vercel.app
  if (trimmedPattern === 'https://*.vercel.app') {
    // Requires https://, single DNS label (1-63 chars, alphanumeric or interior hyphens), followed by .vercel.app
    // Strictly anchored to reject ports, paths, query params, and nested subdomains
    const vercelRegex = /^https:\/\/[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.vercel\.app$/;
    return vercelRegex.test(trimmedOrigin);
  }

  return false;
}

/**
 * Resolves CORS headers strictly for authorized origins.
 * If origin is omitted or unauthorized, no Access-Control-Allow-Origin header is emitted.
 */
export function resolveCorsHeaders(
  requestOrigin?: string,
  allowedOriginsConfig?: string
): Record<string, string> {
  const allowedConfig = allowedOriginsConfig ?? getEnv().CORS_ALLOWED_ORIGINS;
  const allowedList = allowedConfig.split(',').map((o) => o.trim()).filter(Boolean);

  const baseHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Bootstrap-Secret',
    'Access-Control-Max-Age': '86400',
  };

  if (!requestOrigin) {
    // Missing Origin (e.g., direct API client, curl): do not emit Access-Control-Allow-Origin
    return baseHeaders;
  }

  const isAllowed = allowedList.some((pattern) => isOriginAllowed(requestOrigin, pattern));

  if (!isAllowed) {
    // Unauthorized origin: do NOT emit Access-Control-Allow-Origin
    return baseHeaders;
  }

  return {
    ...baseHeaders,
    'Access-Control-Allow-Origin': requestOrigin,
    'Access-Control-Allow-Credentials': 'true',
  };
}
