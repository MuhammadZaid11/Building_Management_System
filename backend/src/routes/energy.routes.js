const express = require('express');
const controller = require('../controllers/energy.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../utils/validate');
const schema = require('../validators/energy.validator');
const { authenticateToken, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/summary', authorize('energy:read'), validate(schema.summary), asyncHandler(controller.summary));
router.get('/trend', authorize('energy:read'), validate(schema.trend), asyncHandler(controller.trend));
router.get('/buildings', authorize('energy:read'), validate(schema.buildings), asyncHandler(controller.buildings));
router.get('/compare', authorize('energy:read'), validate(schema.compare), asyncHandler(controller.compare));
router.get('/devices/:id', authorize('energy:read'), validate(schema.device), asyncHandler(controller.device));

module.exports = router;
