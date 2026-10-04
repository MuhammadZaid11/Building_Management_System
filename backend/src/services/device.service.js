const { prisma } = require('../db/prisma');
const { assertFound } = require('../utils/apiError');
const { onlyDefined } = require('../utils/data');
const { findPage } = require('../utils/pagination');

const roomSelect = { select: { id: true, name: true, roomNumber: true, zoneId: true } };

const detailInclude = {
  room: roomSelect,
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

async function list(query) {
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

  return findPage(prisma.device, {
    where,
    page: query.page,
    limit: query.limit,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    include: { room: roomSelect },
  });
}

async function getById(id) {
  const device = await prisma.device.findUnique({
    where: { id },
    include: detailInclude,
  });

  return assertFound(device, 'Device not found');
}

async function create(input) {
  return prisma.device.create({
    data: onlyDefined(input),
    include: { room: roomSelect },
  });
}

async function update(id, input) {
  await getById(id);

  return prisma.device.update({
    where: { id },
    data: onlyDefined(input),
    include: detailInclude,
  });
}

async function remove(id) {
  const existing = await prisma.device.findUnique({ where: { id }, select: { id: true } });
  assertFound(existing, 'Device not found');
  await prisma.device.delete({ where: { id } });
  return { id };
}

module.exports = { list, getById, create, update, remove };
