// F0964: API response envelope - consistent data/error/meta response shape
// F0965: API error codes - consistent error code strings per error type

import { NextResponse } from 'next/server'

/**
 * F0965: Standard API error codes
 */
export const ErrorCodes = {
  // Client errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_PHONE_NUMBER: 'INVALID_PHONE_NUMBER',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_DATE: 'INVALID_DATE',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Business logic errors
  CONTACT_OPTED_OUT: 'CONTACT_OPTED_OUT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  NO_AVAILABILITY: 'NO_AVAILABILITY',
  BOOKING_CONFLICT: 'BOOKING_CONFLICT',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

/**
 * F0964: API response envelope interface
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: ErrorCode
    message: string
    details?: any
  }
  meta?: {
    timestamp: string
    requestId?: string
    version?: string
    pagination?: {
      page: number
      pageSize: number
      totalCount: number
      totalPages: number
    }
  }
}

/**
 * F0964: Create success response with consistent envelope
 */
export function apiSuccess<T>(
  data: T,
  meta?: ApiResponse['meta']
): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      ...meta,
    },
  }

  return NextResponse.json(response, { status: 200 })
}

/**
 * F0964: Create error response with consistent envelope
 */
export function apiError(
  code: ErrorCode,
  message: string,
  status: number = 500,
  details?: any
): NextResponse<ApiResponse<never>> {
  const response: ApiResponse<never> = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
    },
  }

  return NextResponse.json(response, { status })
}

/**
 * F0964: Create paginated success response
 */
export function apiPaginated<T>(
  data: T[],
  page: number,
  pageSize: number,
  totalCount: number
): NextResponse<ApiResponse<T[]>> {
  const totalPages = Math.ceil(totalCount / pageSize)

  const response: ApiResponse<T[]> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
    },
  }

  return NextResponse.json(response, { status: 200 })
}

/**
 * F0965: Map HTTP status to error code
 */
export function httpStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ErrorCodes.BAD_REQUEST
    case 401:
      return ErrorCodes.UNAUTHORIZED
    case 403:
      return ErrorCodes.FORBIDDEN
    case 404:
      return ErrorCodes.NOT_FOUND
    case 409:
      return ErrorCodes.CONFLICT
    case 422:
      return ErrorCodes.UNPROCESSABLE_ENTITY
    case 429:
      return ErrorCodes.RATE_LIMIT_EXCEEDED
    case 503:
      return ErrorCodes.SERVICE_UNAVAILABLE
    default:
      return ErrorCodes.INTERNAL_ERROR
  }
}

/**
 * F0965: Common validation errors
 */
export const ValidationErrors = {
  missingField: (field: string) =>
    apiError(
      ErrorCodes.MISSING_REQUIRED_FIELD,
      `Missing required field: ${field}`,
      400,
      { field }
    ),

  invalidPhone: (phone: string) =>
    apiError(
      ErrorCodes.INVALID_PHONE_NUMBER,
      'Invalid phone number format. Use E.164 format (e.g., +14155551234)',
      400,
      { phone }
    ),

  invalidEmail: (email: string) =>
    apiError(ErrorCodes.INVALID_EMAIL, `Invalid email format: ${email}`, 400, { email }),

  invalidDate: (date: string) =>
    apiError(ErrorCodes.INVALID_DATE, `Invalid date format: ${date}`, 400, { date }),
}

/**
 * F0966: Parse pagination params from request
 */
export function parsePaginationParams(searchParams: URLSearchParams): {
  page: number
  pageSize: number
  offset: number
} {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
  const offset = (page - 1) * pageSize

  return { page, pageSize, offset }
}

/**
 * Convenience wrapper object for cleaner API response syntax
 */
export const apiResponse = {
  success: <T>(data: T, meta?: ApiResponse['meta']) => apiSuccess(data, meta),
  error: (message: string, status: number = 500, details?: any) =>
    apiError(httpStatusToErrorCode(status), message, status, details),
  paginated: <T>(data: T[], page: number, pageSize: number, totalCount: number) =>
    apiPaginated(data, page, pageSize, totalCount),
}
