/**
 * CORS Configuration Module
 *
 * This module provides secure CORS configuration for the VDID Protocol API.
 *
 * SECURITY CONSIDERATIONS:
 * - Never use '*' for Access-Control-Allow-Origin in production
 * - Always validate origins against a whitelist
 * - Be restrictive with allowed methods and headers
 * - Enable credentials only when necessary
 */

/**
 * Parse allowed origins from environment variable
 * @returns {string[]} Array of allowed origin URLs
 */
function parseAllowedOrigins() {
  const envOrigins = process.env.CORS_ORIGINS || '';

  if (!envOrigins) {
    console.warn('[CORS] No CORS_ORIGINS configured, using default localhost origins');
    return [
      'http://localhost:3000',
      'http://localhost:4173',
      'http://localhost:5173'
    ];
  }

  return envOrigins
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
}

/**
 * Validate if an origin URL is properly formatted
 * @param {string} origin - Origin URL to validate
 * @returns {boolean} True if valid
 */
function isValidOriginFormat(origin) {
  try {
    const url = new URL(origin);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Create CORS options with dynamic origin validation
 * @returns {Object} CORS configuration object
 */
export function createCorsOptions() {
  const allowedOrigins = parseAllowedOrigins();
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Validate all configured origins
  allowedOrigins.forEach(origin => {
    if (!isValidOriginFormat(origin)) {
      console.error(`[CORS] Invalid origin format: ${origin}`);
    }
  });

  console.log('[CORS] Allowed origins:', allowedOrigins);

  return {
    /**
     * Dynamic origin validation function
     * @param {string} origin - Request origin
     * @param {Function} callback - Callback with (error, allowed)
     */
    origin: function(origin, callback) {
      // Allow requests with no origin (server-to-server, same-origin, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in the whitelist
      if (allowedOrigins.includes(origin)) {
        console.log(`[CORS] Allowed origin: ${origin}`);
        return callback(null, true);
      }

      // In development mode, log rejected origins for debugging
      if (isDevelopment) {
        console.warn(`[CORS] Rejected origin: ${origin}`);
        console.warn(`[CORS] Allowed origins are: ${allowedOrigins.join(', ')}`);
      } else {
        console.log(`[CORS] Rejected origin: ${origin}`);
      }

      const error = new Error('Not allowed by CORS');
      error.status = 403;
      callback(error);
    },

    // Allowed HTTP methods
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],

    // Allowed headers in requests
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-Request-ID'
    ],

    // Headers exposed to the browser
    exposedHeaders: [
      'X-Request-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],

    // Allow credentials (cookies, authorization headers)
    credentials: true,

    // Preflight cache duration (24 hours)
    maxAge: 86400,

    // Automatically handle OPTIONS preflight
    preflightContinue: false,

    // Return 204 for successful OPTIONS
    optionsSuccessStatus: 204
  };
}

/**
 * CORS error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function corsErrorHandler(err, req, res, next) {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CORS_ERROR',
        message: 'Cross-origin request not allowed',
        details: process.env.NODE_ENV === 'development'
          ? `Origin '${req.headers.origin}' is not in the allowed list`
          : undefined
      }
    });
  }
  next(err);
}

export default {
  createCorsOptions,
  corsErrorHandler
};
