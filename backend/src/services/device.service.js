const { prisma } = require('../db/prisma');
const { ApiError, assertFound } = require('../utils/apiError');
const { onlyDefined } = require('../utils/data');
const { findPage } = require('../utils/pagination');
const { attachLatestReadings } = require('../utils/sensorReadings');
const realtime = require('./realtime.service');

const locationSelect = {
  select: {
    id: true,
    name: true,
    roomNumber: true,
    zone: {
      select: {
        id: true,
        name: true,
        code: true,
        floor: {
          select: {
            id: true,
            name: true,
            floorNumber: true,
            building: { select: { id: true, name: true, code: true } },
          },
        },
      },
    },
  },
};

const detailInclude = {
  room: locationSelect,
  sensors: {
    orderBy: { name: 'asc' },
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

  if (query.roomId) {
    where.roomId = query.roomId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.deviceType) {
    where.deviceType = query.deviceType;
  }

  if (query.buildingId) {
    where.room = { zone: { floor: { buildingId: query.buildingId } } };
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { deviceCode: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

async function list(query) {
  return findPage(prisma.device, {
    where: filters(query),
    page: query.page,
    limit: query.limit,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    include: { room: locationSelect },
  });
}

async function withLatestSensorReadings(device) {
  return {
    ...device,
    sensors: await attachLatestReadings(device.sensors || []),
  };
}

async function getById(id) {
  const device = await prisma.device.findUnique({
    where: { id },
    include: detailInclude,
  });

  assertFound(device, 'Device not found');
  return withLatestSensorReadings(device);
}

async function create(input) {
  return prisma.device.create({
    data: onlyDefined(input),
    include: { room: locationSelect },
  });
}

async function update(id, input) {
  const current = await getById(id);

  const device = await prisma.device.update({
    where: { id },
    data: onlyDefined(input),
    include: detailInclude,
  });

  const updated = await withLatestSensorReadings(device);

  if (input.status && input.status !== current.status) {
    realtime.emitDeviceStatusChanged({
      deviceId: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt,
      buildingId: updated.room.zone.floor.building.id,
    });
  }

  return updated;
}

async function remove(id) {
  const existing = await prisma.device.findUnique({
    where: { id },
    select: {
      id: true,
      _count: { select: { workOrders: true, maintenanceSchedules: true } },
    },
  });
  assertFound(existing, 'Device not found');

  if (existing._count.workOrders > 0 || existing._count.maintenanceSchedules > 0) {
    throw new ApiError(
      409,
      'DEVICE_HAS_MAINTENANCE_HISTORY',
      'This device cannot be deleted because maintenance history depends on it'
    );
  }

  await prisma.device.delete({ where: { id } });
  return { id };
}

module.exports = { list, getById, create, update, remove, locationSelect };
