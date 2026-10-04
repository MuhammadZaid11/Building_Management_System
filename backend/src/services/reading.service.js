const { prisma } = require('../db/prisma');
const { assertFound } = require('../utils/apiError');
const { onlyDefined } = require('../utils/data');
const { findPage } = require('../utils/pagination');

const sensorSelect = {
  select: { id: true, name: true, sensorType: true, unit: true, deviceId: true },
};

async function list(query) {
  const where = {};

  if (query.sensorId) {
    where.sensorId = query.sensorId;
  }

  if (query.from || query.to) {
    where.recordedAt = {};

    if (query.from) {
      where.recordedAt.gte = query.from;
    }

    if (query.to) {
      where.recordedAt.lte = query.to;
    }
  }

  return findPage(prisma.deviceReading, {
    where,
    page: query.page,
    limit: query.limit,
    orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
    include: { sensor: sensorSelect },
  });
}

async function getById(id) {
  const reading = await prisma.deviceReading.findUnique({
    where: { id },
    include: { sensor: sensorSelect },
  });

  return assertFound(reading, 'Reading not found');
}

async function create(input) {
  return prisma.deviceReading.create({
    data: onlyDefined(input),
    include: { sensor: sensorSelect },
  });
}

module.exports = { list, getById, create };
