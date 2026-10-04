const { prisma } = require('../db/prisma');
const { ApiError, assertFound } = require('../utils/apiError');
const { onlyDefined } = require('../utils/data');
const { findPage } = require('../utils/pagination');

const detailInclude = {
  device: { select: { id: true, name: true, deviceCode: true, deviceType: true } },
  building: { select: { id: true, name: true, code: true } },
  zone: { select: { id: true, name: true, code: true } },
};

async function assertConsistentLocation(input, current = {}) {
  const deviceId = input.deviceId !== undefined ? input.deviceId : current.deviceId;
  const buildingId = input.buildingId !== undefined ? input.buildingId : current.buildingId;
  const zoneId = input.zoneId !== undefined ? input.zoneId : current.zoneId;

  if (!deviceId || !buildingId) {
    return;
  }

  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: {
      room: {
        select: {
          zone: {
            select: {
              floor: { select: { buildingId: true } },
            },
          },
        },
      },
    },
  });

  if (!device) {
    throw new ApiError(400, 'RELATED_RECORD_NOT_FOUND', 'A related record was not found');
  }

  if (device.room.zone.floor.buildingId !== buildingId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', [
      {
        field: 'body.buildingId',
        message: 'buildingId must be the building that contains the device',
      },
    ]);
  }

  if (!zoneId) {
    return;
  }

  const zone = await prisma.zone.findUnique({
    where: { id: zoneId },
    select: { floor: { select: { buildingId: true } } },
  });

  if (!zone || zone.floor.buildingId !== buildingId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', [
      {
        field: 'body.zoneId',
        message: 'zoneId must belong to the same building as the device',
      },
    ]);
  }
}

function withStatusTimestamps(input) {
  const data = { ...input };

  if (data.status === 'ACKNOWLEDGED' && data.acknowledgedAt === undefined) {
    data.acknowledgedAt = new Date();
  }

  if (data.status === 'RESOLVED' && data.resolvedAt === undefined) {
    data.resolvedAt = new Date();
  }

  return data;
}

async function list(query) {
  const where = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.severity) {
    where.severity = query.severity;
  }

  if (query.buildingId) {
    where.buildingId = query.buildingId;
  }

  return findPage(prisma.alarm, {
    where,
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

async function create(input) {
  await assertConsistentLocation(input);

  return prisma.alarm.create({
    data: onlyDefined(withStatusTimestamps(input)),
    include: detailInclude,
  });
}

async function update(id, input) {
  const current = await getById(id);
  await assertConsistentLocation(input, current);

  return prisma.alarm.update({
    where: { id },
    data: onlyDefined(withStatusTimestamps(input)),
    include: detailInclude,
  });
}

module.exports = { list, getById, create, update };
