const floorService = require('../services/floor.service');
const { sendSuccess } = require('../utils/apiResponse');

async function list(req, res) {
  const result = await floorService.list(req.validated.query);
  sendSuccess(res, 200, 'Floors retrieved successfully', result.data, result.pagination);
}

async function getById(req, res) {
  const floor = await floorService.getById(req.validated.params.id);
  sendSuccess(res, 200, 'Floor retrieved successfully', floor);
}

async function create(req, res) {
  const floor = await floorService.create(req.validated.body);
  sendSuccess(res, 201, 'Floor created successfully', floor);
}

async function update(req, res) {
  const floor = await floorService.update(req.validated.params.id, req.validated.body);
  sendSuccess(res, 200, 'Floor updated successfully', floor);
}

async function remove(req, res) {
  const floor = await floorService.remove(req.validated.params.id);
  sendSuccess(res, 200, 'Floor deleted successfully', floor);
}

module.exports = { list, getById, create, update, remove };
