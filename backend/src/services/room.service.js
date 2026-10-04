const { prisma } = require('../db/prisma');
const { assertFound } = require('../utils/apiError');
const { onlyDefined } = require('../utils/data');
const { findPage } = require('../utils/pagination');

const zoneSelect = { select: { id: true, name: true, code: true, floorId: true } };

const detailInclude = {
  zone: zoneSelect,
  devices: {
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      deviceCode: true,
      deviceType: true,
      status: true,
    },
  },
};

async function list(query) {
  const where = {};

  if (query.zoneId) {
    where.zoneId = query.zoneId;
  }

  if (query.buildingId) {
    where.zone = { floor: { buildingId: query.buildingId } };
  }

  return findPage(prisma.room, {
    where,
    page: query.page,
    limit: query.limit,
    orderBy: [{ roomNumber: 'asc' }, { id: 'asc' }],
    include: { zone: zoneSelect },
  });
}

async function getById(id) {
  const room = await prisma.room.findUnique({
    where: { id },
    include: detailInclude,
  });

  return assertFound(room, 'Room not found');
}

async function create(input) {
  return prisma.room.create({
    data: onlyDefined(input),
    include: { zone: zoneSelect },
  });
}

async function update(id, input) {
  await getById(id);

  return prisma.room.update({
    where: { id },
    data: onlyDefined(input),
    include: detailInclude,
  });
}

async function remove(id) {
  const existing = await prisma.room.findUnique({ where: { id }, select: { id: true } });
  assertFound(existing, 'Room not found');
  await prisma.room.delete({ where: { id } });
  return { id };
}

module.exports = { list, getById, create, update, remove };
