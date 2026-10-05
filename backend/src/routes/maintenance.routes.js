const express = require('express');
const controller = require('../controllers/maintenance.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../utils/validate');
const schema = require('../validators/maintenance.validator');
const { authenticateToken, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken);

router.get('/summary', authorize('maintenance:read'), asyncHandler(controller.summary));
router.get('/technicians', authorize('maintenance:read'), asyncHandler(controller.technicians));

router.get('/schedules', authorize('maintenance:read'), validate(schema.listSchedules), asyncHandler(controller.listSchedules));
router.post('/schedules', authorize('maintenance:write'), validate(schema.createSchedule), asyncHandler(controller.createSchedule));
router.get('/schedules/:id', authorize('maintenance:read'), validate(schema.byId), asyncHandler(controller.getSchedule));
router.put('/schedules/:id', authorize('maintenance:write'), validate(schema.updateSchedule), asyncHandler(controller.updateSchedule));
router.delete('/schedules/:id', authorize('maintenance:write'), validate(schema.byId), asyncHandler(controller.removeSchedule));

router.get('/work-orders', authorize('maintenance:read'), validate(schema.listWorkOrders), asyncHandler(controller.listWorkOrders));
router.post('/work-orders', authorize('maintenance:write'), validate(schema.createWorkOrder), asyncHandler(controller.createWorkOrder));
router.get('/work-orders/:id', authorize('maintenance:read'), validate(schema.byId), asyncHandler(controller.getWorkOrder));
router.patch('/work-orders/:id', authorize('maintenance:write'), validate(schema.updateWorkOrder), asyncHandler(controller.updateWorkOrder));
router.patch('/work-orders/:id/assign', authorize('maintenance:assign'), validate(schema.assign), asyncHandler(controller.assign));
router.patch('/work-orders/:id/start', authorize('maintenance:execute'), validate(schema.byId), asyncHandler(controller.start));
router.patch('/work-orders/:id/hold', authorize('maintenance:execute'), validate(schema.byId), asyncHandler(controller.hold));
router.patch('/work-orders/:id/resume', authorize('maintenance:execute'), validate(schema.byId), asyncHandler(controller.resume));
router.patch('/work-orders/:id/complete', authorize('maintenance:execute'), validate(schema.complete), asyncHandler(controller.complete));
router.patch('/work-orders/:id/cancel', authorize('maintenance:write'), validate(schema.byId), asyncHandler(controller.cancel));
router.get('/work-orders/:id/activities', authorize('maintenance:read'), validate(schema.byId), asyncHandler(controller.listActivities));
router.post('/work-orders/:id/activities', authorize('maintenance:execute'), validate(schema.createActivity), asyncHandler(controller.addActivity));

module.exports = router;
