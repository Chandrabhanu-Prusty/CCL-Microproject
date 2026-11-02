import type { ApiResponse, StandardErrorPayload } from '../types/common.js';
import { AppError } from './errors.js';
import { resolveCorsHeaders } from './cors.js';

export function jsonResponse<T>(
  statusCode: number,
  data: T,
  requestOrigin?: string,
  extraHeaders: Record<string, string> = {}
): ApiResponse<T> {
  const corsHeaders = resolveCorsHeaders(requestOrigin);

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...extraHeaders,
    },
    body: JSON.stringify(data),
  };
}

export function errorResponse(error: unknown, requestOrigin?: string): ApiResponse<StandardErrorPayload> {
  if (error instanceof AppError) {
    return jsonResponse<StandardErrorPayload>(
      error.statusCode,
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      requestOrigin
    );
  }

  console.error('Unhandled Server Exception:', error);
  return jsonResponse<StandardErrorPayload>(
    500,
    {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal error occurred.',
      },
    },
    requestOrigin
  );
}

export function optionsResponse(requestOrigin?: string): ApiResponse<null> {
  const corsHeaders = resolveCorsHeaders(requestOrigin);
  return {
    statusCode: 204,
    headers: corsHeaders,
    body: '',
  };
}

