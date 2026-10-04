const sensorService = require('../services/sensor.service');
const { sendSuccess } = require('../utils/apiResponse');

async function list(req, res) {
  const result = await sensorService.list(req.validated.query);
  sendSuccess(res, 200, 'Sensors retrieved successfully', result.data, result.pagination);
}

async function getById(req, res) {
  const sensor = await sensorService.getById(req.validated.params.id);
  sendSuccess(res, 200, 'Sensor retrieved successfully', sensor);
}

async function create(req, res) {
  const sensor = await sensorService.create(req.validated.body);
  sendSuccess(res, 201, 'Sensor created successfully', sensor);
}

async function update(req, res) {
  const sensor = await sensorService.update(req.validated.params.id, req.validated.body);
  sendSuccess(res, 200, 'Sensor updated successfully', sensor);
}

async function remove(req, res) {
  const sensor = await sensorService.remove(req.validated.params.id);
  sendSuccess(res, 200, 'Sensor deleted successfully', sensor);
}

module.exports = { list, getById, create, update, remove };
