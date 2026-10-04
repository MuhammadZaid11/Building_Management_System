const express = require('express');
const controller = require('../controllers/sensor.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../utils/validate');
const schema = require('../validators/sensor.validator');
const { authenticateToken, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize('sensors:read'), validate(schema.list), asyncHandler(controller.list));
router.post('/', authorize('sensors:write'), validate(schema.create), asyncHandler(controller.create));
router.get('/:id', authorize('sensors:read'), validate(schema.byId), asyncHandler(controller.getById));
router.put('/:id', authorize('sensors:write'), validate(schema.update), asyncHandler(controller.update));
router.delete('/:id', authorize('sensors:write'), validate(schema.byId), asyncHandler(controller.remove));

module.exports = router;
