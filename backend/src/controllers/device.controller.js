const deviceService = require('../services/device.service');
const { sendSuccess } = require('../utils/apiResponse');

async function list(req, res) {
  const result = await deviceService.list(req.validated.query);
  sendSuccess(res, 200, 'Devices retrieved successfully', result.data, result.pagination);
}

async function getById(req, res) {
  const device = await deviceService.getById(req.validated.params.id);
  sendSuccess(res, 200, 'Device retrieved successfully', device);
}

async function create(req, res) {
  const device = await deviceService.create(req.validated.body);
  sendSuccess(res, 201, 'Device created successfully', device);
}

async function update(req, res) {
  const device = await deviceService.update(req.validated.params.id, req.validated.body);
  sendSuccess(res, 200, 'Device updated successfully', device);
}

async function remove(req, res) {
  const device = await deviceService.remove(req.validated.params.id);
  sendSuccess(res, 200, 'Device deleted successfully', device);
}

module.exports = { list, getById, create, update, remove };
