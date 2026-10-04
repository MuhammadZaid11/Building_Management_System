const express = require('express');
const controller = require('../controllers/room.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../utils/validate');
const schema = require('../validators/room.validator');
const { authenticateToken, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/', authorize('structure:read'), validate(schema.list), asyncHandler(controller.list));
router.post('/', authorize('structure:write'), validate(schema.create), asyncHandler(controller.create));
router.get('/:id', authorize('structure:read'), validate(schema.byId), asyncHandler(controller.getById));
router.put('/:id', authorize('structure:write'), validate(schema.update), asyncHandler(controller.update));
router.delete('/:id', authorize('structure:write'), validate(schema.byId), asyncHandler(controller.remove));

module.exports = router;
