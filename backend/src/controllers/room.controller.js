const roomService = require('../services/room.service');
const { sendSuccess } = require('../utils/apiResponse');

async function list(req, res) {
  const result = await roomService.list(req.validated.query);
  sendSuccess(res, 200, 'Rooms retrieved successfully', result.data, result.pagination);
}

async function getById(req, res) {
  const room = await roomService.getById(req.validated.params.id);
  sendSuccess(res, 200, 'Room retrieved successfully', room);
}

async function create(req, res) {
  const room = await roomService.create(req.validated.body);
  sendSuccess(res, 201, 'Room created successfully', room);
}

async function update(req, res) {
  const room = await roomService.update(req.validated.params.id, req.validated.body);
  sendSuccess(res, 200, 'Room updated successfully', room);
}

async function remove(req, res) {
  const room = await roomService.remove(req.validated.params.id);
  sendSuccess(res, 200, 'Room deleted successfully', room);
}

module.exports = { list, getById, create, update, remove };
