const zoneService = require('../services/zone.service');
const { sendSuccess } = require('../utils/apiResponse');

async function list(req, res) {
  const result = await zoneService.list(req.validated.query);
  sendSuccess(res, 200, 'Zones retrieved successfully', result.data, result.pagination);
}

async function getById(req, res) {
  const zone = await zoneService.getById(req.validated.params.id);
  sendSuccess(res, 200, 'Zone retrieved successfully', zone);
}

async function create(req, res) {
  const zone = await zoneService.create(req.validated.body);
  sendSuccess(res, 201, 'Zone created successfully', zone);
}

async function update(req, res) {
  const zone = await zoneService.update(req.validated.params.id, req.validated.body);
  sendSuccess(res, 200, 'Zone updated successfully', zone);
}

async function remove(req, res) {
  const zone = await zoneService.remove(req.validated.params.id);
  sendSuccess(res, 200, 'Zone deleted successfully', zone);
}

module.exports = { list, getById, create, update, remove };
