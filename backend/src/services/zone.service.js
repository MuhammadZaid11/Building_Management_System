const { prisma } = require('../db/prisma');
const { assertFound } = require('../utils/apiError');
const { onlyDefined } = require('../utils/data');
const { findPage } = require('../utils/pagination');

const floorSelect = {
  select: { id: true, name: true, floorNumber: true, buildingId: true },
};

const detailInclude = {
  floor: floorSelect,
  rooms: {
    orderBy: { roomNumber: 'asc' },
    select: { id: true, name: true, roomNumber: true },
  },
};

async function list(query) {
  const where = {};

  if (query.floorId) {
    where.floorId = query.floorId;
  }

  return findPage(prisma.zone, {
    where,
    page: query.page,
    limit: query.limit,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    include: {
      floor: floorSelect,
      _count: { select: { rooms: true } },
    },
  });
}

async function getById(id) {
  const zone = await prisma.zone.findUnique({
    where: { id },
    include: detailInclude,
  });

  return assertFound(zone, 'Zone not found');
}

async function create(input) {
  return prisma.zone.create({
    data: onlyDefined(input),
    include: { floor: floorSelect },
  });
}

async function update(id, input) {
  await getById(id);

  return prisma.zone.update({
    where: { id },
    data: onlyDefined(input),
    include: detailInclude,
  });
}

async function remove(id) {
  const existing = await prisma.zone.findUnique({ where: { id }, select: { id: true } });
  assertFound(existing, 'Zone not found');
  await prisma.zone.delete({ where: { id } });
  return { id };
}

module.exports = { list, getById, create, update, remove };
