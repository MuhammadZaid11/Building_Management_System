const alarmService = require('../services/alarm.service');
const { sendSuccess } = require('../utils/apiResponse');

async function list(req, res) {
  const result = await alarmService.list(req.validated.query);
  sendSuccess(res, 200, 'Alarms retrieved successfully', result.data, result.pagination);
}

async function summary(req, res) {
  const counts = await alarmService.summary();
  sendSuccess(res, 200, 'Alarm summary retrieved successfully', counts);
}

async function getById(req, res) {
  const alarm = await alarmService.getById(req.validated.params.id);
  sendSuccess(res, 200, 'Alarm retrieved successfully', alarm);
}

async function acknowledge(req, res) {
  const alarm = await alarmService.acknowledge(req.validated.params.id);
  sendSuccess(res, 200, 'Alarm acknowledged successfully', alarm);
}

async function resolve(req, res) {
  const alarm = await alarmService.resolve(req.validated.params.id);
  sendSuccess(res, 200, 'Alarm resolved successfully', alarm);
}

module.exports = { list, summary, getById, acknowledge, resolve };
