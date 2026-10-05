const maintenanceService = require('../services/maintenance.service');
const { sendSuccess } = require('../utils/apiResponse');

async function summary(req, res) {
  const counts = await maintenanceService.summary();
  sendSuccess(res, 200, 'Maintenance summary retrieved successfully', counts);
}

async function technicians(req, res) {
  const users = await maintenanceService.listTechnicians();
  sendSuccess(res, 200, 'Assignable technicians retrieved successfully', users);
}

async function listWorkOrders(req, res) {
  const result = await maintenanceService.listWorkOrders(req.validated.query);
  sendSuccess(res, 200, 'Work orders retrieved successfully', result.data, result.pagination);
}

async function getWorkOrder(req, res) {
  const workOrder = await maintenanceService.getWorkOrder(req.validated.params.id);
  sendSuccess(res, 200, 'Work order retrieved successfully', workOrder);
}

async function createWorkOrder(req, res) {
  const workOrder = await maintenanceService.createWorkOrder(req.validated.body, req.user);
  sendSuccess(res, 201, 'Work order created successfully', workOrder);
}

async function updateWorkOrder(req, res) {
  const workOrder = await maintenanceService.updateWorkOrder(req.validated.params.id, req.validated.body);
  sendSuccess(res, 200, 'Work order updated successfully', workOrder);
}

async function assign(req, res) {
  const workOrder = await maintenanceService.assignWorkOrder(
    req.validated.params.id,
    req.validated.body.assignedToId
  );
  sendSuccess(res, 200, 'Work order assigned successfully', workOrder);
}

async function start(req, res) {
  const workOrder = await maintenanceService.startWorkOrder(req.validated.params.id, req.user);
  sendSuccess(res, 200, 'Work order started successfully', workOrder);
}

async function hold(req, res) {
  const workOrder = await maintenanceService.holdWorkOrder(req.validated.params.id, req.user);
  sendSuccess(res, 200, 'Work order placed on hold successfully', workOrder);
}

async function resume(req, res) {
  const workOrder = await maintenanceService.resumeWorkOrder(req.validated.params.id, req.user);
  sendSuccess(res, 200, 'Work order resumed successfully', workOrder);
}

async function complete(req, res) {
  const workOrder = await maintenanceService.completeWorkOrder(
    req.validated.params.id,
    req.user,
    req.validated.body
  );
  sendSuccess(res, 200, 'Work order completed successfully', workOrder);
}

async function cancel(req, res) {
  const workOrder = await maintenanceService.cancelWorkOrder(req.validated.params.id);
  sendSuccess(res, 200, 'Work order cancelled successfully', workOrder);
}

async function listActivities(req, res) {
  const activities = await maintenanceService.listActivities(req.validated.params.id);
  sendSuccess(res, 200, 'Maintenance activities retrieved successfully', activities);
}

async function addActivity(req, res) {
  const workOrder = await maintenanceService.addActivity(
    req.validated.params.id,
    req.user,
    req.validated.body
  );
  sendSuccess(res, 201, 'Maintenance activity recorded successfully', workOrder);
}

async function listSchedules(req, res) {
  const result = await maintenanceService.listSchedules(req.validated.query);
  sendSuccess(res, 200, 'Maintenance schedules retrieved successfully', result.data, result.pagination);
}

async function getSchedule(req, res) {
  const schedule = await maintenanceService.getSchedule(req.validated.params.id);
  sendSuccess(res, 200, 'Maintenance schedule retrieved successfully', schedule);
}

async function createSchedule(req, res) {
  const schedule = await maintenanceService.createSchedule(req.validated.body, req.user);
  sendSuccess(res, 201, 'Maintenance schedule created successfully', schedule);
}

async function updateSchedule(req, res) {
  const schedule = await maintenanceService.updateSchedule(req.validated.params.id, req.validated.body);
  sendSuccess(res, 200, 'Maintenance schedule updated successfully', schedule);
}

async function removeSchedule(req, res) {
  const result = await maintenanceService.removeSchedule(req.validated.params.id);
  sendSuccess(res, 200, 'Maintenance schedule deleted successfully', result);
}

module.exports = {
  summary,
  technicians,
  listWorkOrders,
  getWorkOrder,
  createWorkOrder,
  updateWorkOrder,
  assign,
  start,
  hold,
  resume,
  complete,
  cancel,
  listActivities,
  addActivity,
  listSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  removeSchedule,
};
