const express = require('express');
const controller = require('../controllers/user.controller');
const { authenticateToken, authorize } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../utils/validate');
const schema = require('../validators/user.validator');

const router = express.Router();

router.use(authenticateToken, authorize('users:manage'));

router.get('/', validate(schema.list), asyncHandler(controller.list));
router.post('/', validate(schema.create), asyncHandler(controller.create));
router.patch('/:id/status', validate(schema.updateStatus), asyncHandler(controller.updateStatus));
router.get('/:id', validate(schema.byId), asyncHandler(controller.getById));
router.put('/:id', validate(schema.update), asyncHandler(controller.update));

module.exports = router;
