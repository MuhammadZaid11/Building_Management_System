const { prisma } = require('../db/prisma');
const { assertFound } = require('../utils/apiError');
const { onlyDefined } = require('../utils/data');
const { findPage } = require('../utils/pagination');

const detailInclude = {
  floors: {
    orderBy: { floorNumber: 'asc' },
    include: {
      zones: {
        orderBy: { name: 'asc' },
        include: {
          rooms: {
            orderBy: { roomNumber: 'asc' },
            include: {
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
            },
          },
        },
      },
    },
  },
};

async function list(query) {
  const where = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { code: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  return findPage(prisma.building, {
    where,
    page: query.page,
    limit: query.limit,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    include: {
      _count: { select: { floors: true } },
    },
  });
}

async function getById(id) {
  const building = await prisma.building.findUnique({
    where: { id },
    include: detailInclude,
  });

  return assertFound(building, 'Building not found');
}

async function create(input) {
  return prisma.building.create({
    data: onlyDefined(input),
  });
}

async function update(id, input) {
  await getById(id);

  return prisma.building.update({
    where: { id },
    data: onlyDefined(input),
    include: detailInclude,
  });
}

async function remove(id) {
  const existing = await prisma.building.findUnique({ where: { id }, select: { id: true } });
  assertFound(existing, 'Building not found');
  await prisma.building.delete({ where: { id } });
  return { id };
}

module.exports = { list, getById, create, update, remove };
