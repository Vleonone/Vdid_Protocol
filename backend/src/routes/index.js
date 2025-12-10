/**
 * Routes Index Module
 *
 * Central router configuration for all API endpoints.
 */

import { Router } from 'express';
import identityRoutes from './identity.routes.js';
import walletRoutes from './wallet.routes.js';
import vscoreRoutes from './vscore.routes.js';

const router = Router();

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    }
  });
});

/**
 * API info endpoint
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'VDID Protocol API',
      version: '1.0.0',
      description: 'Verifiable Decentralized Identity Protocol API',
      documentation: '/api/docs',
      endpoints: {
        identity: '/api/identity',
        wallets: '/api/wallets',
        vscore: '/vscore'
      }
    }
  });
});

// Mount route modules
router.use('/identity', identityRoutes);
router.use('/wallets', walletRoutes);

export { router as apiRouter, vscoreRoutes };
