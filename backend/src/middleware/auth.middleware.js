/**
 * Authentication Middleware Module
 *
 * Provides JWT-based authentication for the VDID Protocol API.
 *
 * SECURITY NOTES:
 * - Always verify JWT signature
 * - Check token expiration
 * - Validate token claims
 * - Never log sensitive token data
 */

import crypto from 'crypto';

/**
 * Simple JWT verification (for demo purposes)
 * In production, use a proper JWT library like jose or jsonwebtoken
 */

/**
 * Decode base64url string
 * @param {string} str - Base64url encoded string
 * @returns {string} Decoded string
 */
function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

/**
 * Verify JWT token (simplified implementation)
 * @param {string} token - JWT token
 * @param {string} secret - Secret key
 * @returns {Object|null} Decoded payload or null if invalid
 */
function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature
    const signatureData = `${headerB64}.${payloadB64}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signatureData)
      .digest('base64url');

    if (signatureB64 !== expectedSignature) {
      return null;
    }

    // Decode payload
    const payload = JSON.parse(base64urlDecode(payloadB64));

    // Check expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Create a JWT token (simplified implementation)
 * @param {Object} payload - Token payload
 * @param {string} secret - Secret key
 * @param {string} expiresIn - Expiration time (e.g., '24h')
 * @returns {string} JWT token
 */
export function createToken(payload, secret, expiresIn = '24h') {
  const header = { alg: 'HS256', typ: 'JWT' };

  // Parse expiration
  let expMs = 24 * 60 * 60 * 1000; // Default 24h
  if (expiresIn.endsWith('h')) {
    expMs = parseInt(expiresIn) * 60 * 60 * 1000;
  } else if (expiresIn.endsWith('d')) {
    expMs = parseInt(expiresIn) * 24 * 60 * 60 * 1000;
  }

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + Math.floor(expMs / 1000)
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Authentication middleware
 * Validates JWT token from Authorization header
 * @returns {Function} Express middleware
 */
export function authMiddleware() {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_AUTH_HEADER',
          message: 'Authorization header is required'
        }
      });
    }

    // Check Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_AUTH_FORMAT',
          message: 'Authorization header must use Bearer token format'
        }
      });
    }

    const token = authHeader.slice(7);
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error('[AUTH] JWT_SECRET not configured');
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_CONFIG_ERROR',
          message: 'Server authentication not configured'
        }
      });
    }

    const payload = verifyToken(token, secret);

    if (!payload) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
    }

    // Attach user info to request
    req.user = {
      id: payload.sub,
      did: payload.did,
      wallets: payload.wallets || [],
      roles: payload.roles || []
    };

    next();
  };
}

/**
 * Optional auth middleware
 * Validates token if present, but allows unauthenticated requests
 * @returns {Function} Express middleware
 */
export function optionalAuthMiddleware() {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.slice(7);
    const secret = process.env.JWT_SECRET;

    if (secret) {
      const payload = verifyToken(token, secret);
      if (payload) {
        req.user = {
          id: payload.sub,
          did: payload.did,
          wallets: payload.wallets || [],
          roles: payload.roles || []
        };
      } else {
        req.user = null;
      }
    } else {
      req.user = null;
    }

    next();
  };
}

/**
 * Role-based authorization middleware
 * @param {string[]} allowedRoles - Roles that can access the route
 * @returns {Function} Express middleware
 */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
    }

    next();
  };
}

export default {
  authMiddleware,
  optionalAuthMiddleware,
  requireRoles,
  createToken
};
