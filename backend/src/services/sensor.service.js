const { prisma } = require('../db/prisma');
const { ApiError, assertFound } = require('../utils/apiError');
const { onlyDefined } = require('../utils/data');
const { findPage } = require('../utils/pagination');

const deviceSelect = {
  select: { id: true, name: true, deviceCode: true, deviceType: true },
};

function decimalNumber(value) {
  if (value === null || value === undefined) {
    return value;
  }

  return Number(value.toString());
}

function assertRange(minValue, maxValue) {
  if (
    minValue !== null &&
    minValue !== undefined &&
    maxValue !== null &&
    maxValue !== undefined &&
    decimalNumber(minValue) > decimalNumber(maxValue)
  ) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Request validation failed',
      [{ field: 'body.minValue', message: 'minValue must be less than or equal to maxValue' }]
    );
  }
}

async function list(query) {
  const where = {};

  if (query.deviceId) {
    where.deviceId = query.deviceId;
  }

  return findPage(prisma.sensor, {
    where,
    page: query.page,
    limit: query.limit,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    include: { device: deviceSelect },
  });
}

async function getById(id) {
  const sensor = await prisma.sensor.findUnique({
    where: { id },
    include: { device: deviceSelect },
  });

  return assertFound(sensor, 'Sensor not found');
}

async function create(input) {
  assertRange(input.minValue, input.maxValue);

  return prisma.sensor.create({
    data: onlyDefined(input),
    include: { device: deviceSelect },
  });
}

async function update(id, input) {
  const current = await prisma.sensor.findUnique({ where: { id } });
  assertFound(current, 'Sensor not found');

  const minValue = input.minValue !== undefined ? input.minValue : current.minValue;
  const maxValue = input.maxValue !== undefined ? input.maxValue : current.maxValue;
  assertRange(minValue, maxValue);

  return prisma.sensor.update({
    where: { id },
    data: onlyDefined(input),
    include: { device: deviceSelect },
  });
}

async function remove(id) {
  const existing = await prisma.sensor.findUnique({ where: { id }, select: { id: true } });
  assertFound(existing, 'Sensor not found');
  await prisma.sensor.delete({ where: { id } });
  return { id };
}

module.exports = { list, getById, create, update, remove };
