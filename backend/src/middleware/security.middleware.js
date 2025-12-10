/**
 * Security Middleware Module
 *
 * Provides comprehensive security middleware for the VDID Protocol API.
 *
 * SECURITY FEATURES:
 * - Helmet for security headers
 * - Rate limiting
 * - Request ID tracking
 * - Input sanitization helpers
 */

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';

/**
 * Configure Helmet security headers
 * @returns {Function} Helmet middleware
 */
export function createHelmetMiddleware() {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    // Prevent clickjacking
    frameguard: { action: 'deny' },
    // Hide X-Powered-By header
    hidePoweredBy: true,
    // Strict Transport Security
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    // Prevent MIME type sniffing
    noSniff: true,
    // XSS protection
    xssFilter: true,
    // Referrer policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  });
}

/**
 * Create rate limiter middleware
 * @param {Object} options - Rate limit options
 * @returns {Function} Rate limiter middleware
 */
export function createRateLimiter(options = {}) {
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes
  const max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil(windowMs / 1000)
      }
    },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    keyGenerator: (req) => {
      // Use X-Forwarded-For for proxied requests, fallback to IP
      return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
             req.socket?.remoteAddress ||
             'unknown';
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/api/health';
    },
    ...options
  });
}

/**
 * Request ID middleware - adds unique ID to each request
 * @returns {Function} Middleware function
 */
export function requestIdMiddleware() {
  return (req, res, next) => {
    // Use existing request ID from header or generate new one
    req.id = req.headers['x-request-id'] || `req_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    res.setHeader('X-Request-ID', req.id);
    next();
  };
}

/**
 * Request logging middleware with security considerations
 * @returns {Function} Middleware function
 */
export function requestLogger() {
  return (req, res, next) => {
    const start = Date.now();

    // Log on response finish
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logData = {
        requestId: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent']?.substring(0, 100) // Truncate for safety
      };

      // Determine log level based on status code
      if (res.statusCode >= 500) {
        console.error('[REQUEST]', JSON.stringify(logData));
      } else if (res.statusCode >= 400) {
        console.warn('[REQUEST]', JSON.stringify(logData));
      } else {
        console.log('[REQUEST]', JSON.stringify(logData));
      }
    });

    next();
  };
}

/**
 * Sanitize string input - basic XSS prevention
 * @param {string} input - String to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') return input;

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate Ethereum address format
 * @param {string} address - Ethereum address to validate
 * @returns {boolean} True if valid format
 */
export function isValidEthAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate DID format (did:vdid:...)
 * @param {string} did - DID to validate
 * @returns {boolean} True if valid format
 */
export function isValidDID(did) {
  return /^did:vdid:[a-zA-Z0-9._-]+$/.test(did);
}

/**
 * Security headers validation middleware
 * Ensures critical security headers are present
 */
export function validateSecurityHeaders() {
  return (req, res, next) => {
    // Add security headers if not present
    if (!res.getHeader('X-Content-Type-Options')) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    if (!res.getHeader('X-Frame-Options')) {
      res.setHeader('X-Frame-Options', 'DENY');
    }
    next();
  };
}

export default {
  createHelmetMiddleware,
  createRateLimiter,
  requestIdMiddleware,
  requestLogger,
  sanitizeString,
  isValidEthAddress,
  isValidDID,
  validateSecurityHeaders
};
