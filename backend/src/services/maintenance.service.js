const { prisma } = require('../db/prisma');
const { ApiError, assertFound } = require('../utils/apiError');
const { onlyDefined } = require('../utils/data');
const { findPage } = require('../utils/pagination');
const { locationSelect } = require('./device.service');
const realtime = require('./realtime.service');
const {
  ASSIGNABLE_ROLES,
  transitionTo,
  costSummary,
  dueState,
  canExecute,
} = require('../utils/maintenance');

const personSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
};

const listInclude = {
  device: { select: { id: true, name: true, deviceCode: true, deviceType: true } },
  building: { select: { id: true, name: true, code: true } },
  assignedTo: { select: { id: true, name: true, role: true } },
  alarm: { select: { id: true, type: true, severity: true, status: true } },
};

const detailInclude = {
  device: {
    select: {
      id: true,
      name: true,
      deviceCode: true,
      deviceType: true,
      status: true,
      room: locationSelect,
    },
  },
  building: { select: { id: true, name: true, code: true } },
  alarm: {
    select: {
      id: true,
      type: true,
      severity: true,
      status: true,
      message: true,
      triggeredAt: true,
    },
  },
  assignedTo: { select: personSelect },
  createdBy: { select: personSelect },
  activities: {
    orderBy: [{ performedAt: 'asc' }, { createdAt: 'asc' }],
    include: { performedBy: { select: personSelect } },
  },
};

const scheduleInclude = {
  device: {
    select: {
      id: true,
      name: true,
      deviceCode: true,
      room: locationSelect,
    },
  },
  createdBy: { select: { id: true, name: true, role: true } },
};

function presentWorkOrder(workOrder) {
  return {
    ...workOrder,
    costs: costSummary(workOrder, workOrder.activities || []),
  };
}

function presentSchedule(schedule, now = new Date()) {
  const room = schedule.device?.room;
  const building = room?.zone?.floor?.building || null;

  return {
    ...schedule,
    building,
    dueState: dueState(schedule, now),
  };
}

function workOrderFilters(query) {
  const where = {};

  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.deviceId) where.deviceId = query.deviceId;
  if (query.buildingId) where.buildingId = query.buildingId;
  if (query.assignedToId) where.assignedToId = query.assignedToId;
  if (query.alarmId) where.alarmId = query.alarmId;

  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = query.from;
    if (query.to) where.createdAt.lte = query.to;
  }

  if (query.search) {
    where.OR = [
      { workOrderNumber: { contains: query.search, mode: 'insensitive' } },
      { title: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

async function loadDevice(deviceId) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    include: { room: locationSelect },
  });

  assertFound(device, 'Device not found');
  return device;
}

function buildingOf(device) {
  return device.room.zone.floor.building;
}

async function assertAlarmLink(alarmId, deviceId, buildingId) {
  if (!alarmId) {
    return null;
  }

  const alarm = await prisma.alarm.findUnique({ where: { id: alarmId } });
  assertFound(alarm, 'Alarm not found');

  if (alarm.deviceId !== deviceId || alarm.buildingId !== buildingId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Alarm does not belong to the selected device');
  }

  return alarm;
}

async function assertAssignee(assignedToId) {
  const user = await prisma.user.findUnique({
    where: { id: assignedToId },
    select: { id: true, isActive: true, role: true, name: true },
  });

  if (!user) {
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Assigned user not found');
  }

  if (!user.isActive) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Assigned user is inactive');
  }

  if (!ASSIGNABLE_ROLES.includes(user.role)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Work orders cannot be assigned to a viewer');
  }

  return user;
}

async function nextWorkOrderNumber(tx, now = new Date()) {
  const year = now.getUTCFullYear();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${year})`;
  const prefix = `WO-${year}-`;
  const latest = await tx.workOrder.findFirst({
    where: { workOrderNumber: { startsWith: prefix } },
    orderBy: { workOrderNumber: 'desc' },
    select: { workOrderNumber: true },
  });
  const current = latest ? Number(latest.workOrderNumber.slice(prefix.length)) : 0;
  const sequence = Number.isFinite(current) ? current + 1 : 1;
  return `${prefix}${String(sequence).padStart(6, '0')}`;
}

async function getWorkOrder(id) {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    include: detailInclude,
  });

  return presentWorkOrder(assertFound(workOrder, 'Work order not found'));
}

function requireTransition(action, workOrder) {
  const next = transitionTo(action, workOrder.status);

  if (!next) {
    throw new ApiError(
      409,
      'INVALID_STATE_TRANSITION',
      `Cannot ${action} a work order that is ${workOrder.status}`
    );
  }

  return next;
}

function requireExecutor(actor, workOrder) {
  if (!canExecute(actor, workOrder)) {
    throw new ApiError(403, 'FORBIDDEN', 'You can only update work orders assigned to you');
  }
}

function emitMaintenance(event, workOrder) {
  realtime.emitMaintenance(event, {
    workOrderId: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    title: workOrder.title,
    status: workOrder.status,
    priority: workOrder.priority,
    assignedToId: workOrder.assignedToId,
    deviceId: workOrder.deviceId,
    buildingId: workOrder.buildingId,
    updatedAt: workOrder.updatedAt,
  });
}

async function listWorkOrders(query) {
  return findPage(prisma.workOrder, {
    where: workOrderFilters(query),
    page: query.page,
    limit: query.limit,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: listInclude,
  });
}

async function summary() {
  const [grouped, critical, overdue] = await Promise.all([
    prisma.workOrder.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.workOrder.count({
      where: {
        priority: 'CRITICAL',
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
    }),
    prisma.maintenanceSchedule.count({
      where: { isActive: true, nextDueAt: { lte: new Date() } },
    }),
  ]);

  const counts = {
    open: 0,
    assigned: 0,
    inProgress: 0,
    onHold: 0,
    completed: 0,
    cancelled: 0,
  };

  for (const row of grouped) {
    if (row.status === 'OPEN') counts.open = row._count._all;
    if (row.status === 'ASSIGNED') counts.assigned = row._count._all;
    if (row.status === 'IN_PROGRESS') counts.inProgress = row._count._all;
    if (row.status === 'ON_HOLD') counts.onHold = row._count._all;
    if (row.status === 'COMPLETED') counts.completed = row._count._all;
    if (row.status === 'CANCELLED') counts.cancelled = row._count._all;
  }

  return { ...counts, overdue, critical };
}

async function createWorkOrder(input, actor) {
  const device = await loadDevice(input.deviceId);
  const building = buildingOf(device);
  await assertAlarmLink(input.alarmId, device.id, building.id);

  if (input.assignedToId) {
    await assertAssignee(input.assignedToId);
  }

  const now = new Date();
  const workOrder = await prisma.$transaction(async (tx) => {
    const workOrderNumber = await nextWorkOrderNumber(tx, now);

    return tx.workOrder.create({
      data: {
        workOrderNumber,
        title: input.title,
        description: input.description ?? null,
        deviceId: device.id,
        alarmId: input.alarmId ?? null,
        buildingId: building.id,
        assignedToId: input.assignedToId ?? null,
        createdById: actor.id,
        priority: input.priority,
        status: input.assignedToId ? 'ASSIGNED' : 'OPEN',
        scheduledAt: input.scheduledAt ?? null,
        assignedAt: input.assignedToId ? now : null,
        estimatedCost: input.estimatedCost ?? null,
      },
      include: detailInclude,
    });
  });

  const presented = presentWorkOrder(workOrder);
  emitMaintenance('created', presented);
  if (presented.assignedToId) {
    emitMaintenance('assigned', presented);
  }
  return presented;
}

async function updateWorkOrder(id, input) {
  const current = await prisma.workOrder.findUnique({ where: { id }, select: { id: true, status: true } });
  assertFound(current, 'Work order not found');

  if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
    throw new ApiError(409, 'INVALID_STATE_TRANSITION', 'Completed and cancelled work orders cannot be edited');
  }

  await prisma.workOrder.update({
    where: { id },
    data: onlyDefined({
      title: input.title,
      description: input.description,
      priority: input.priority,
      scheduledAt: input.scheduledAt,
      estimatedCost: input.estimatedCost,
    }),
  });

  return getWorkOrder(id);
}

async function assignWorkOrder(id, assignedToId) {
  const current = await prisma.workOrder.findUnique({ where: { id } });
  assertFound(current, 'Work order not found');
  requireTransition('assign', current);
  await assertAssignee(assignedToId);

  const now = new Date();
  await prisma.workOrder.update({
    where: { id },
    data: {
      assignedToId,
      assignedAt: now,
      status: 'ASSIGNED',
    },
  });

  const workOrder = await getWorkOrder(id);
  emitMaintenance('assigned', workOrder);
  return workOrder;
}

async function changeStatus(id, action, actor, data) {
  const current = await prisma.workOrder.findUnique({ where: { id } });
  assertFound(current, 'Work order not found');
  requireExecutor(actor, current);
  const status = requireTransition(action, current);
  const now = new Date();

  await prisma.workOrder.update({
    where: { id },
    data: { status, ...data(now, current) },
  });

  return getWorkOrder(id);
}

async function startWorkOrder(id, actor) {
  const workOrder = await changeStatus(id, 'start', actor, (now) => ({ startedAt: now }));
  emitMaintenance('started', workOrder);
  return workOrder;
}

async function holdWorkOrder(id, actor) {
  const workOrder = await changeStatus(id, 'hold', actor, (now) => ({ heldAt: now }));
  emitMaintenance('onHold', workOrder);
  return workOrder;
}

async function resumeWorkOrder(id, actor) {
  const workOrder = await changeStatus(id, 'resume', actor, () => ({}));
  emitMaintenance('resumed', workOrder);
  return workOrder;
}

async function completeWorkOrder(id, actor, input) {
  const workOrder = await changeStatus(id, 'complete', actor, () => ({
    completedAt: input.completedAt || new Date(),
    completionNotes: input.completionNotes,
    actualCost: input.actualCost === undefined ? undefined : input.actualCost,
  }));
  emitMaintenance('completed', workOrder);
  return workOrder;
}

async function cancelWorkOrder(id) {
  const current = await prisma.workOrder.findUnique({ where: { id } });
  assertFound(current, 'Work order not found');
  requireTransition('cancel', current);

  await prisma.workOrder.update({
    where: { id },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });

  const workOrder = await getWorkOrder(id);
  emitMaintenance('cancelled', workOrder);
  return workOrder;
}

async function listActivities(workOrderId) {
  await prisma.workOrder.findUnique({ where: { id: workOrderId }, select: { id: true } }).then((row) => {
    assertFound(row, 'Work order not found');
  });

  return prisma.maintenanceActivity.findMany({
    where: { workOrderId },
    orderBy: [{ performedAt: 'asc' }, { createdAt: 'asc' }],
    include: { performedBy: { select: personSelect } },
  });
}

async function addActivity(workOrderId, actor, input) {
  const current = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  assertFound(current, 'Work order not found');
  requireExecutor(actor, current);

  if (current.status !== 'IN_PROGRESS') {
    throw new ApiError(409, 'INVALID_STATE_TRANSITION', 'Activities can only be added while work is in progress');
  }

  await prisma.maintenanceActivity.create({
    data: {
      workOrderId,
      performedById: actor.id,
      description: input.description,
      notes: input.notes ?? null,
      cost: input.cost ?? null,
      performedAt: input.performedAt || new Date(),
    },
  });

  return getWorkOrder(workOrderId);
}

function scheduleFilters(query, now = new Date()) {
  const where = {};

  if (query.deviceId) where.deviceId = query.deviceId;
  if (query.isActive === 'true') where.isActive = true;
  if (query.isActive === 'false') where.isActive = false;

  if (query.buildingId) {
    where.device = { room: { zone: { floor: { buildingId: query.buildingId } } } };
  }

  if (query.due === 'true') {
    where.isActive = true;
    where.nextDueAt = { lte: now };
  }

  return where;
}

async function listSchedules(query) {
  const result = await findPage(prisma.maintenanceSchedule, {
    where: scheduleFilters(query),
    page: query.page,
    limit: query.limit,
    orderBy: [{ nextDueAt: 'asc' }, { id: 'asc' }],
    include: scheduleInclude,
  });

  return {
    data: result.data.map((schedule) => presentSchedule(schedule)),
    pagination: result.pagination,
  };
}

async function getSchedule(id) {
  const schedule = await prisma.maintenanceSchedule.findUnique({
    where: { id },
    include: scheduleInclude,
  });

  return presentSchedule(assertFound(schedule, 'Maintenance schedule not found'));
}

async function createSchedule(input, actor) {
  await loadDevice(input.deviceId);

  const schedule = await prisma.maintenanceSchedule.create({
    data: {
      deviceId: input.deviceId,
      title: input.title,
      description: input.description ?? null,
      frequency: input.frequency,
      nextDueAt: input.nextDueAt,
      lastCompletedAt: input.lastCompletedAt ?? null,
      isActive: input.isActive === undefined ? true : input.isActive,
      createdById: actor.id,
    },
    include: scheduleInclude,
  });

  return presentSchedule(schedule);
}

async function updateSchedule(id, input) {
  await getSchedule(id);

  if (input.deviceId) {
    await loadDevice(input.deviceId);
  }

  const schedule = await prisma.maintenanceSchedule.update({
    where: { id },
    data: onlyDefined({
      deviceId: input.deviceId,
      title: input.title,
      description: input.description,
      frequency: input.frequency,
      nextDueAt: input.nextDueAt,
      lastCompletedAt: input.lastCompletedAt,
      isActive: input.isActive,
    }),
    include: scheduleInclude,
  });

  return presentSchedule(schedule);
}

async function removeSchedule(id) {
  await getSchedule(id);
  await prisma.maintenanceSchedule.delete({ where: { id } });
  return { id };
}

async function listTechnicians() {
  return prisma.user.findMany({
    where: { isActive: true, role: { in: ASSIGNABLE_ROLES } },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
}

module.exports = {
  listWorkOrders,
  getWorkOrder,
  createWorkOrder,
  updateWorkOrder,
  assignWorkOrder,
  startWorkOrder,
  holdWorkOrder,
  resumeWorkOrder,
  completeWorkOrder,
  cancelWorkOrder,
  listActivities,
  addActivity,
  listSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  removeSchedule,
  summary,
  listTechnicians,
};
