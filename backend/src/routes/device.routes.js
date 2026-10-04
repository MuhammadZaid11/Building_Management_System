const express = require('express');
const controller = require('../controllers/device.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../utils/validate');
const schema = require('../validators/device.validator');
const {
  authenticateToken,
  authorize,
  limitTechnicianDeviceUpdate,
} = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize('devices:read'), validate(schema.list), asyncHandler(controller.list));
router.post('/', authorize('devices:write'), validate(schema.create), asyncHandler(controller.create));
router.get('/:id', authorize('devices:read'), validate(schema.byId), asyncHandler(controller.getById));
router.put(
  '/:id',
  authorize('devices:update-status'),
  limitTechnicianDeviceUpdate,
  validate(schema.update),
  asyncHandler(controller.update)
);
router.delete('/:id', authorize('devices:delete'), validate(schema.byId), asyncHandler(controller.remove));

module.exports = router;
