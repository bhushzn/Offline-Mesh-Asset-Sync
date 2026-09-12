// ============================================================
// TacSync Backend — Utility Helpers
// ============================================================

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a UUID v4.
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Build a standard success response.
 */
export function successResponse<T>(data: T, meta?: Record<string, unknown>) {
  return {
    success: true as const,
    data,
    ...(meta ? { meta } : {}),
  };
}

/**
 * Build a paginated response.
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    success: true as const,
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Parse pagination query parameters.
 */
export function parsePagination(query: { page?: string; limit?: string }) {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
