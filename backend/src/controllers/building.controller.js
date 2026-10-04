const buildingService = require('../services/building.service');
const { sendSuccess } = require('../utils/apiResponse');

async function list(req, res) {
  const result = await buildingService.list(req.validated.query);
  sendSuccess(res, 200, 'Buildings retrieved successfully', result.data, result.pagination);
}

async function getById(req, res) {
  const building = await buildingService.getById(req.validated.params.id);
  sendSuccess(res, 200, 'Building retrieved successfully', building);
}

async function create(req, res) {
  const building = await buildingService.create(req.validated.body);
  sendSuccess(res, 201, 'Building created successfully', building);
}

async function update(req, res) {
  const building = await buildingService.update(req.validated.params.id, req.validated.body);
  sendSuccess(res, 200, 'Building updated successfully', building);
}

async function remove(req, res) {
  const building = await buildingService.remove(req.validated.params.id);
  sendSuccess(res, 200, 'Building deleted successfully', building);
}

module.exports = { list, getById, create, update, remove };
