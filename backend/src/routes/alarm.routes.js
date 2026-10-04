const express = require('express');
const controller = require('../controllers/alarm.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../utils/validate');
const schema = require('../validators/alarm.validator');
const {
  authenticateToken,
  authorize,
  limitAlarmAcknowledgement,
} = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize('alarms:read'), validate(schema.list), asyncHandler(controller.list));
router.post('/', authorize('alarms:write'), validate(schema.create), asyncHandler(controller.create));
router.get('/:id', authorize('alarms:read'), validate(schema.byId), asyncHandler(controller.getById));
router.put(
  '/:id',
  authorize('alarms:acknowledge'),
  limitAlarmAcknowledgement,
  validate(schema.update),
  asyncHandler(controller.update)
);

module.exports = router;
