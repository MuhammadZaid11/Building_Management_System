const express = require('express');
const controller = require('../controllers/reading.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../utils/validate');
const schema = require('../validators/reading.validator');
const { authenticateToken, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize('readings:read'), validate(schema.list), asyncHandler(controller.list));
router.post('/', authorize('readings:write'), validate(schema.create), asyncHandler(controller.create));
router.get('/:id', authorize('readings:read'), validate(schema.byId), asyncHandler(controller.getById));

module.exports = router;
