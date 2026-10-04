const express = require('express');
const { checkDatabase } = require('../db/prisma');

function createHealthRouter() {
  const router = express.Router();

  router.get('/health', async (req, res) => {
    try {
      const connected = await checkDatabase();

      if (!connected) {
        return res.status(503).json({
          success: false,
          data: {
            status: 'unhealthy',
            database: 'disconnected',
          },
          error: {
            code: 'DATABASE_UNAVAILABLE',
            message: 'Database is unreachable',
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          status: 'healthy',
          database: 'connected',
        },
      });
    } catch (error) {
      console.error('Database health check failed:', error.message);

      return res.status(503).json({
        success: false,
        data: {
          status: 'unhealthy',
          database: 'disconnected',
        },
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'Database is unreachable',
        },
      });
    }
  });

  return router;
}

module.exports = { createHealthRouter };
