const userService = require('../services/user.service');
const { sendSuccess } = require('../utils/apiResponse');

async function list(req, res) {
  const result = await userService.list(req.validated.query);
  sendSuccess(res, 200, 'Users retrieved successfully', result.data, result.pagination);
}

async function getById(req, res) {
  const user = await userService.getById(req.validated.params.id);
  sendSuccess(res, 200, 'User retrieved successfully', user);
}

async function create(req, res) {
  const user = await userService.create(req.validated.body);
  sendSuccess(res, 201, 'User created successfully', user);
}

async function update(req, res) {
  const user = await userService.update(req.validated.params.id, req.validated.body);
  sendSuccess(res, 200, 'User updated successfully', user);
}

async function updateStatus(req, res) {
  const user = await userService.updateStatus(req.validated.params.id, req.validated.body.isActive);
  sendSuccess(res, 200, 'User status updated successfully', user);
}

module.exports = { list, getById, create, update, updateStatus };
