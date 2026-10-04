const express = require('express');
const controller = require('../controllers/building.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../utils/validate');
const schema = require('../validators/building.validator');
const { authenticateToken, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize('buildings:read'), validate(schema.list), asyncHandler(controller.list));
router.post('/', authorize('buildings:write'), validate(schema.create), asyncHandler(controller.create));
router.get('/:id', authorize('buildings:read'), validate(schema.byId), asyncHandler(controller.getById));
router.put('/:id', authorize('buildings:write'), validate(schema.update), asyncHandler(controller.update));
router.delete('/:id', authorize('buildings:delete'), validate(schema.byId), asyncHandler(controller.remove));

module.exports = router;
