/**
 * VDID Protocol Backend Server
 *
 * Main entry point for the VDID Protocol API server.
 *
 * SECURITY FEATURES:
 * - CORS configuration with origin whitelist
 * - Helmet security headers
 * - Rate limiting
 * - Request logging
 * - Centralized error handling
 */

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import configurations
import { createCorsOptions, corsErrorHandler } from './config/cors.config.js';

// Import middleware
import {
  createHelmetMiddleware,
  createRateLimiter,
  requestIdMiddleware,
  requestLogger,
  validateSecurityHeaders
} from './middleware/security.middleware.js';
import { notFoundHandler, errorHandler } from './middleware/error.middleware.js';

// Import routes
import { apiRouter, vscoreRoutes } from './routes/index.js';

// Create Express app
const app = express();

// ===========================================
// MIDDLEWARE CONFIGURATION
// ===========================================

// 1. Request ID - must be first for logging
app.use(requestIdMiddleware());

// 2. Security headers (Helmet)
app.use(createHelmetMiddleware());

// 3. CORS configuration - CRITICAL for fixing the reported errors
const corsOptions = createCorsOptions();
app.use(cors(corsOptions));

// 4. Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.LOG_FORMAT || 'dev'));
  app.use(requestLogger());
}

// 5. Rate limiting
app.use(createRateLimiter());

// 6. Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 7. Additional security headers
app.use(validateSecurityHeaders());

// ===========================================
// ROUTES
// ===========================================

// Root health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString()
    }
  });
});

// API routes
app.use('/api', apiRouter);

// V-Score routes (at root level as shown in error logs)
app.use('/vscore', vscoreRoutes);

// ===========================================
// ERROR HANDLING
// ===========================================

// CORS error handler
app.use(corsErrorHandler);

// 404 handler
app.use(notFoundHandler());

// Global error handler - must be last
app.use(errorHandler());

// ===========================================
// SERVER STARTUP
// ===========================================

const PORT = parseInt(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log('===========================================');
  console.log('VDID Protocol Backend Server');
  console.log('===========================================');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server ready to accept connections`);
  console.log(`  Host: ${HOST}`);
  console.log(`  Port: ${PORT}`);
  console.log(`  URL: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log('===========================================');
  console.log('[CORS] Configuration loaded');
  console.log('[Security] Helmet headers enabled');
  console.log('[Security] Rate limiting enabled');
  console.log('===========================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
  // In production, you might want to exit the process
  // process.exit(1);
});

export default app;
