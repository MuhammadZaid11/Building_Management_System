const express = require('express');
const controller = require('../controllers/alarm.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../utils/validate');
const schema = require('../validators/alarm.validator');
const { authenticateToken, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/summary', authorize('alarms:read'), asyncHandler(controller.summary));
router.get('/', authorize('alarms:read'), validate(schema.list), asyncHandler(controller.list));
router.get('/:id', authorize('alarms:read'), validate(schema.byId), asyncHandler(controller.getById));
router.patch(
  '/:id/acknowledge',
  authorize('alarms:acknowledge'),
  validate(schema.byId),
  asyncHandler(controller.acknowledge)
);
router.patch(
  '/:id/resolve',
  authorize('alarms:resolve'),
  validate(schema.byId),
  asyncHandler(controller.resolve)
);

module.exports = router;
