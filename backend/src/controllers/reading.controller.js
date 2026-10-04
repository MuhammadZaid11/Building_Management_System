const readingService = require('../services/reading.service');
const { sendSuccess } = require('../utils/apiResponse');

async function list(req, res) {
  const result = await readingService.list(req.validated.query);
  sendSuccess(res, 200, 'Readings retrieved successfully', result.data, result.pagination);
}

async function getById(req, res) {
  const reading = await readingService.getById(req.validated.params.id);
  sendSuccess(res, 200, 'Reading retrieved successfully', reading);
}

async function create(req, res) {
  const reading = await readingService.create(req.validated.body);
  sendSuccess(res, 201, 'Reading created successfully', reading);
}

module.exports = { list, getById, create };
