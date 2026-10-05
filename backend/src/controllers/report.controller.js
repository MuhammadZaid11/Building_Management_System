const reportService = require('../services/report.service');
const { sendSuccess } = require('../utils/apiResponse');

function withWindow(query) {
  const to = query.to || new Date();
  const from = query.from || new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { ...query, from, to };
}

async function executiveSummary(req, res) {
  const data = await reportService.executiveSummary(withWindow(req.validated.query));
  sendSuccess(res, 200, 'Executive summary retrieved successfully', data);
}

async function buildingHealth(req, res) {
  const data = await reportService.buildingHealth(withWindow(req.validated.query));
  sendSuccess(res, 200, 'Building health retrieved successfully', data);
}

async function deviceStatus(req, res) {
  const data = await reportService.deviceStatus(withWindow(req.validated.query));
  sendSuccess(res, 200, 'Device status report retrieved successfully', data);
}

async function alarmTrends(req, res) {
  const data = await reportService.alarmTrends(withWindow(req.validated.query));
  sendSuccess(res, 200, 'Alarm trends retrieved successfully', data);
}

async function energyTrends(req, res) {
  const data = await reportService.energyTrends(withWindow(req.validated.query));
  sendSuccess(res, 200, 'Energy trends retrieved successfully', data);
}

async function maintenanceKpis(req, res) {
  const data = await reportService.maintenanceKpis(withWindow(req.validated.query));
  sendSuccess(res, 200, 'Maintenance KPIs retrieved successfully', data);
}

async function buildings(req, res) {
  const data = await reportService.buildingComparison(withWindow(req.validated.query));
  sendSuccess(res, 200, 'Building comparison retrieved successfully', data);
}

module.exports = {
  executiveSummary,
  buildingHealth,
  deviceStatus,
  alarmTrends,
  energyTrends,
  maintenanceKpis,
  buildings,
};
