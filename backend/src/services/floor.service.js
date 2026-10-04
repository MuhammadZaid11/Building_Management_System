const { prisma } = require('../db/prisma');
const { assertFound } = require('../utils/apiError');
const { onlyDefined } = require('../utils/data');
const { findPage } = require('../utils/pagination');

const buildingSelect = { select: { id: true, name: true, code: true } };

const detailInclude = {
  building: buildingSelect,
  zones: {
    orderBy: { name: 'asc' },
    include: {
      rooms: {
        orderBy: { roomNumber: 'asc' },
        select: { id: true, name: true, roomNumber: true },
      },
    },
  },
};

async function list(query) {
  const where = {};

  if (query.buildingId) {
    where.buildingId = query.buildingId;
  }

  return findPage(prisma.floor, {
    where,
    page: query.page,
    limit: query.limit,
    orderBy: [{ floorNumber: 'asc' }, { id: 'asc' }],
    include: {
      building: buildingSelect,
      _count: { select: { zones: true } },
    },
  });
}

async function getById(id) {
  const floor = await prisma.floor.findUnique({
    where: { id },
    include: detailInclude,
  });

  return assertFound(floor, 'Floor not found');
}

async function create(input) {
  return prisma.floor.create({
    data: onlyDefined(input),
    include: { building: buildingSelect },
  });
}

async function update(id, input) {
  await getById(id);

  return prisma.floor.update({
    where: { id },
    data: onlyDefined(input),
    include: detailInclude,
  });
}

async function remove(id) {
  const existing = await prisma.floor.findUnique({ where: { id }, select: { id: true } });
  assertFound(existing, 'Floor not found');
  await prisma.floor.delete({ where: { id } });
  return { id };
}

module.exports = { list, getById, create, update, remove };
