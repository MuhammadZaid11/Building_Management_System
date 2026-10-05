const express = require('express');
const controller = require('../controllers/report.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../utils/validate');
const schema = require('../validators/report.validator');
const { authenticateToken, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken, authorize('reports:read'));
router.get('/executive-summary', validate(schema.filters), asyncHandler(controller.executiveSummary));
router.get('/building-health', validate(schema.filters), asyncHandler(controller.buildingHealth));
router.get('/device-status', validate(schema.filters), asyncHandler(controller.deviceStatus));
router.get('/alarm-trends', validate(schema.filters), asyncHandler(controller.alarmTrends));
router.get('/energy-trends', validate(schema.filters), asyncHandler(controller.energyTrends));
router.get('/maintenance-kpis', validate(schema.filters), asyncHandler(controller.maintenanceKpis));
router.get('/buildings', validate(schema.filters), asyncHandler(controller.buildings));

module.exports = router;
