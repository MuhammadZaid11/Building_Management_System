const { prisma } = require('../db/prisma');
const { ApiError, assertFound } = require('../utils/apiError');
const { onlyDefined } = require('../utils/data');
const { findPage } = require('../utils/pagination');
const { attachLatestReadings } = require('../utils/sensorReadings');
const { SENSOR_UNITS } = require('../validators/common');
const { locationSelect } = require('./device.service');

const deviceSelect = {
  select: {
    id: true,
    name: true,
    deviceCode: true,
    deviceType: true,
    status: true,
    room: locationSelect,
  },
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

function assertUnit(sensorType, unit) {
  const allowed = SENSOR_UNITS[sensorType] || [];

  if (!allowed.includes(unit)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', [
      { field: 'body.unit', message: `unit must be one of: ${allowed.join(', ')}` },
    ]);
  }
}

function filters(query) {
  const where = {};
  const device = {};

  if (query.search) {
    where.name = { contains: query.search, mode: 'insensitive' };
  }

  if (query.deviceId) {
    where.deviceId = query.deviceId;
  }

  if (query.sensorType) {
    where.sensorType = query.sensorType;
  }

  if (query.roomId) {
    device.roomId = query.roomId;
  }

  if (query.buildingId) {
    device.room = { zone: { floor: { buildingId: query.buildingId } } };
  }

  if (Object.keys(device).length > 0) {
    where.device = device;
  }

  return where;
}

async function list(query) {
  const result = await findPage(prisma.sensor, {
    where: filters(query),
    page: query.page,
    limit: query.limit,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    include: { device: deviceSelect },
  });

  return {
    data: await attachLatestReadings(result.data),
    pagination: result.pagination,
  };
}

async function getById(id) {
  const sensor = await prisma.sensor.findUnique({
    where: { id },
    include: { device: deviceSelect },
  });

  assertFound(sensor, 'Sensor not found');
  const [withLatest] = await attachLatestReadings([sensor]);
  return withLatest;
}

async function assertDevice(deviceId) {
  const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { id: true } });
  assertFound(device, 'Device not found');
}

async function create(input) {
  assertRange(input.minValue, input.maxValue);
  assertUnit(input.sensorType, input.unit);
  await assertDevice(input.deviceId);

  const sensor = await prisma.sensor.create({
    data: onlyDefined(input),
    include: { device: deviceSelect },
  });

  const [withLatest] = await attachLatestReadings([sensor]);
  return withLatest;
}

async function update(id, input) {
  const current = await prisma.sensor.findUnique({ where: { id } });
  assertFound(current, 'Sensor not found');

  const minValue = input.minValue !== undefined ? input.minValue : current.minValue;
  const maxValue = input.maxValue !== undefined ? input.maxValue : current.maxValue;
  const sensorType = input.sensorType !== undefined ? input.sensorType : current.sensorType;
  const unit = input.unit !== undefined ? input.unit : current.unit;

  assertRange(minValue, maxValue);
  assertUnit(sensorType, unit);

  if (input.deviceId) {
    await assertDevice(input.deviceId);
  }

  const sensor = await prisma.sensor.update({
    where: { id },
    data: onlyDefined(input),
    include: { device: deviceSelect },
  });

  const [withLatest] = await attachLatestReadings([sensor]);
  return withLatest;
}

async function remove(id) {
  const existing = await prisma.sensor.findUnique({ where: { id }, select: { id: true } });
  assertFound(existing, 'Sensor not found');

  const readingCount = await prisma.deviceReading.count({ where: { sensorId: id } });

  if (readingCount > 0) {
    throw new ApiError(
      409,
      'SENSOR_HAS_READINGS',
      'This sensor cannot be deleted because historical readings exist.'
    );
  }

  const alarmCount = await prisma.alarm.count({ where: { sensorId: id } });

  if (alarmCount > 0) {
    throw new ApiError(
      409,
      'SENSOR_HAS_ALARMS',
      'This sensor cannot be deleted because alarm history exists.'
    );
  }

  await prisma.sensor.delete({ where: { id } });
  return { id };
}

module.exports = { list, getById, create, update, remove };
