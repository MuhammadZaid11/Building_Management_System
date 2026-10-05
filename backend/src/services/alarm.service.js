const { prisma } = require('../db/prisma');
const { ApiError, assertFound } = require('../utils/apiError');
const realtime = require('./realtime.service');
const { findPage } = require('../utils/pagination');
const { locationSelect } = require('./device.service');

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
  zone: { select: { id: true, name: true, code: true } },
  sensor: {
    select: {
      id: true,
      name: true,
      sensorType: true,
      unit: true,
      minValue: true,
      maxValue: true,
    },
  },
};

function filters(query) {
  const where = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.severity) {
    where.severity = query.severity;
  }

  if (query.type) {
    where.type = query.type;
  }

  if (query.buildingId) {
    where.buildingId = query.buildingId;
  }

  if (query.deviceId) {
    where.deviceId = query.deviceId;
  }

  if (query.sensorId) {
    where.sensorId = query.sensorId;
  }

  if (query.search) {
    where.message = { contains: query.search, mode: 'insensitive' };
  }

  if (query.from || query.to) {
    where.triggeredAt = {};

    if (query.from) {
      where.triggeredAt.gte = query.from;
    }

    if (query.to) {
      where.triggeredAt.lte = query.to;
    }
  }

  return where;
}

async function list(query) {
  return findPage(prisma.alarm, {
    where: filters(query),
    page: query.page,
    limit: query.limit,
    orderBy: [{ triggeredAt: 'desc' }, { id: 'desc' }],
    include: detailInclude,
  });
}

async function getById(id) {
  const alarm = await prisma.alarm.findUnique({
    where: { id },
    include: detailInclude,
  });

  return assertFound(alarm, 'Alarm not found');
}

async function summary() {
  const groups = await prisma.alarm.groupBy({
    by: ['severity'],
    where: { status: 'ACTIVE' },
    _count: { _all: true },
  });

  const counts = { low: 0, medium: 0, high: 0, critical: 0 };

  groups.forEach((group) => {
    counts[group.severity.toLowerCase()] = group._count._all;
  });

  counts.total = counts.low + counts.medium + counts.high + counts.critical;
  return counts;
}

function assertTransition(alarm, allowed, message) {
  if (!allowed.includes(alarm.status)) {
    throw new ApiError(409, 'INVALID_ALARM_TRANSITION', message);
  }
}

function alarmEvent(alarm) {
  return {
    id: alarm.id,
    type: alarm.type,
    severity: alarm.severity,
    status: alarm.status,
    message: alarm.message,
    deviceId: alarm.deviceId,
    buildingId: alarm.buildingId,
    sensorId: alarm.sensorId,
    triggeredAt: alarm.triggeredAt,
    acknowledgedAt: alarm.acknowledgedAt,
    resolvedAt: alarm.resolvedAt,
    previousStatus: alarm.previousStatus || null,
    device: alarm.device ? { id: alarm.device.id, name: alarm.device.name } : null,
    building: alarm.building ? { id: alarm.building.id, name: alarm.building.name } : null,
  };
}

async function acknowledge(id) {
  const current = await getById(id);
  assertTransition(
    current,
    ['ACTIVE'],
    current.status === 'ACKNOWLEDGED'
      ? 'This alarm is already acknowledged.'
      : 'A resolved alarm cannot be acknowledged. A new alarm is created if the condition returns.'
  );

  const alarm = await prisma.alarm.update({
    where: { id },
    data: {
      status: 'ACKNOWLEDGED',
      acknowledgedAt: new Date(),
    },
    include: detailInclude,
  });

  realtime.emitAlarmAcknowledged(alarmEvent({ ...alarm, previousStatus: current.status }));
  return alarm;
}

async function resolve(id) {
  const current = await getById(id);
  assertTransition(current, ['ACTIVE', 'ACKNOWLEDGED'], 'This alarm is already resolved.');

  const alarm = await prisma.alarm.update({
    where: { id },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
    },
    include: detailInclude,
  });

  realtime.emitAlarmResolved(alarmEvent({ ...alarm, previousStatus: current.status }));
  return alarm;
}

module.exports = { list, getById, summary, acknowledge, resolve };
