// Centralized error handling utilities

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR')
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR')
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR')
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND')
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMITED')
  }
}

// Standard API error response formatter
export function formatErrorResponse(error) {
  if (error instanceof AppError) {
    return {
      error: error.message,
      code: error.code,
      status: error.statusCode
    }
  }

  // Database errors
  if (error?.code?.startsWith('P')) {
    return {
      error: 'Database error. Please try again.',
      code: 'DATABASE_ERROR',
      status: 500
    }
  }

  // Connection errors
  if (error?.message?.includes('connection') || error?.message?.includes('timeout')) {
    return {
      error: 'Connection issue. Please try again in a moment.',
      code: 'CONNECTION_ERROR',
      status: 503
    }
  }

  // Default
  return {
    error: process.env.NODE_ENV === 'development' ? error?.message : 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    status: 500
  }
}

// Async handler wrapper for API routes
export function asyncHandler(fn) {
  return async (request, ...args) => {
    try {
      return await fn(request, ...args)
    } catch (error) {
      console.error('[API Error]', error)
      const formatted = formatErrorResponse(error)
      
      const { NextResponse } = await import('next/server')
      return NextResponse.json(
        { error: formatted.error, code: formatted.code },
        { status: formatted.status }
      )
    }
  }
}

// Client-side error handler
export function handleClientError(error, setErrorFn) {
  if (error?.response?.data?.error) {
    setErrorFn(error.response.data.error)
  } else if (error?.message?.includes('Network Error')) {
    setErrorFn('Network error. Please check your connection.')
  } else if (error?.message?.includes('timeout')) {
    setErrorFn('Request timed out. Please try again.')
  } else {
    setErrorFn('Something went wrong. Please try again.')
  }
}

// Log error with context
export function logError(context, error, extra = {}) {
  console.error(`[${context}]`, {
    message: error?.message,
    code: error?.code,
    stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
    ...extra
  })
}
