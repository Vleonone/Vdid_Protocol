/**
 * Error Handling Middleware Module
 *
 * Provides centralized error handling for the VDID Protocol API.
 *
 * SECURITY CONSIDERATIONS:
 * - Never expose stack traces in production
 * - Sanitize error messages before sending to client
 * - Log detailed errors server-side only
 */

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Distinguishes from programming errors
  }

  static badRequest(message, code = 'BAD_REQUEST', details = null) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new ApiError(401, code, message);
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new ApiError(403, code, message);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  }

  static conflict(message, code = 'CONFLICT') {
    return new ApiError(409, code, message);
  }

  static tooManyRequests(message = 'Too many requests', code = 'RATE_LIMIT_EXCEEDED') {
    return new ApiError(429, code, message);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    return new ApiError(500, code, message);
  }
}

/**
 * 404 Not Found handler
 * @returns {Function} Express middleware
 */
export function notFoundHandler() {
  return (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
        requestId: req.id
      }
    });
  };
}

/**
 * Global error handler middleware
 * @returns {Function} Express error middleware
 */
export function errorHandler() {
  return (err, req, res, next) => {
    // Already sent response
    if (res.headersSent) {
      return next(err);
    }

    // Determine if this is an operational error
    const isOperational = err.isOperational || false;
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Log error with context
    const errorLog = {
      requestId: req.id,
      name: err.name,
      message: err.message,
      path: req.path,
      method: req.method,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress
    };

    // Include stack trace in logs (but never in response for production)
    if (isDevelopment || !isOperational) {
      errorLog.stack = err.stack;
    }

    console.error('[ERROR]', `[${req.id}]`, 'Error occurred', errorLog);

    // Determine status code
    let statusCode = err.statusCode || err.status || 500;

    // Handle specific error types
    if (err.name === 'ValidationError') {
      statusCode = 400;
    } else if (err.name === 'JsonWebTokenError') {
      statusCode = 401;
    } else if (err.name === 'TokenExpiredError') {
      statusCode = 401;
    } else if (err.message === 'Not allowed by CORS') {
      statusCode = 403;
    }

    // Build response
    const response = {
      success: false,
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: isOperational ? err.message : 'An unexpected error occurred',
        requestId: req.id
      }
    };

    // Add details in development mode
    if (isDevelopment) {
      response.error.details = err.details || null;
      response.error.stack = err.stack;
    }

    res.status(statusCode).json(response);
  };
}

/**
 * Async handler wrapper - catches async errors
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped handler
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validate request body against schema
 * @param {Object} schema - Validation schema with required/optional fields
 * @returns {Function} Express middleware
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const errors = [];
    const body = req.body || {};

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (body[field] === undefined || body[field] === null || body[field] === '') {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    // Validate field types
    if (schema.fields) {
      for (const [field, config] of Object.entries(schema.fields)) {
        const value = body[field];

        if (value !== undefined) {
          if (config.type && typeof value !== config.type) {
            errors.push(`Field '${field}' must be of type ${config.type}`);
          }

          if (config.pattern && !config.pattern.test(value)) {
            errors.push(`Field '${field}' has invalid format`);
          }

          if (config.minLength && value.length < config.minLength) {
            errors.push(`Field '${field}' must be at least ${config.minLength} characters`);
          }

          if (config.maxLength && value.length > config.maxLength) {
            errors.push(`Field '${field}' must be at most ${config.maxLength} characters`);
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors,
          requestId: req.id
        }
      });
    }

    next();
  };
}

export default {
  ApiError,
  notFoundHandler,
  errorHandler,
  asyncHandler,
  validateBody
};
