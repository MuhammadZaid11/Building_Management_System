const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../utils/validate');
const schema = require('../validators/auth.validator');

const windowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const limit = Number(
  process.env.AUTH_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 20 : 100)
);

const authLimiter = rateLimit({
  windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 15 * 60 * 1000,
  limit: Number.isFinite(limit) && limit > 0 ? limit : 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many authentication attempts. Try again later.',
      },
    });
  },
});

const router = express.Router();

router.post('/register', authLimiter, validate(schema.register), asyncHandler(controller.register));
router.post('/login', authLimiter, validate(schema.login), asyncHandler(controller.login));
router.post('/refresh', authLimiter, validate(schema.refresh), asyncHandler(controller.refresh));
router.post('/logout', authLimiter, validate(schema.logout), asyncHandler(controller.logout));
router.get('/me', authenticateToken, asyncHandler(controller.me));

module.exports = router;
