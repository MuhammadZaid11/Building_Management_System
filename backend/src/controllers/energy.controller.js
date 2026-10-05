const energyService = require('../services/energy.service');
const { sendSuccess } = require('../utils/apiResponse');

async function summary(req, res) {
  const data = await energyService.summary(req.validated.query);
  sendSuccess(res, 200, 'Energy summary retrieved successfully', data);
}

async function trend(req, res) {
  const data = await energyService.trend(req.validated.query);
  sendSuccess(res, 200, 'Energy trend retrieved successfully', data);
}

async function buildings(req, res) {
  const data = await energyService.buildings(req.validated.query);
  sendSuccess(res, 200, 'Building energy retrieved successfully', data);
}

async function device(req, res) {
  const data = await energyService.device(req.validated.params.id, req.validated.query);
  sendSuccess(res, 200, 'Device energy retrieved successfully', data);
}

async function compare(req, res) {
  const data = await energyService.compare(req.validated.query);
  sendSuccess(res, 200, 'Energy comparison retrieved successfully', data);
}

module.exports = { summary, trend, buildings, device, compare };
