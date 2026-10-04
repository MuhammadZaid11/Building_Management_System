const alarmService = require('../services/alarm.service');
const { sendSuccess } = require('../utils/apiResponse');

async function list(req, res) {
  const result = await alarmService.list(req.validated.query);
  sendSuccess(res, 200, 'Alarms retrieved successfully', result.data, result.pagination);
}

async function getById(req, res) {
  const alarm = await alarmService.getById(req.validated.params.id);
  sendSuccess(res, 200, 'Alarm retrieved successfully', alarm);
}

async function create(req, res) {
  const alarm = await alarmService.create(req.validated.body);
  sendSuccess(res, 201, 'Alarm created successfully', alarm);
}

async function update(req, res) {
  const alarm = await alarmService.update(req.validated.params.id, req.validated.body);
  sendSuccess(res, 200, 'Alarm updated successfully', alarm);
}

module.exports = { list, getById, create, update };
