const { prisma } = require('../db/prisma');
const { assertFound } = require('../utils/apiError');
const { findPage } = require('../utils/pagination');
const { presentReading } = require('../utils/sensorReadings');
const { applyReading } = require('./alarmEvaluation.service');
const { locationSelect } = require('./device.service');
const realtime = require('./realtime.service');

const sensorInclude = {
  select: {
    id: true,
    name: true,
    sensorType: true,
    unit: true,
    minValue: true,
    maxValue: true,
    deviceId: true,
    device: {
      select: {
        id: true,
        name: true,
        deviceCode: true,
        deviceType: true,
        status: true,
        room: locationSelect,
      },
    },
  },
};

function filters(query) {
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

  return where;
}

function decorate(reading) {
  return presentReading(reading, reading.sensor);
}

async function list(query) {
  const result = await findPage(prisma.deviceReading, {
    where: filters(query),
    page: query.page,
    limit: query.limit,
    orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
    include: { sensor: sensorInclude },
  });

  return {
    data: result.data.map(decorate),
    pagination: result.pagination,
  };
}

async function getById(id) {
  const reading = await prisma.deviceReading.findUnique({
    where: { id },
    include: { sensor: sensorInclude },
  });

  assertFound(reading, 'Reading not found');
  return decorate(reading);
}

const evaluationInclude = {
  device: {
    select: {
      id: true,
      name: true,
      room: {
        select: {
          zone: {
            select: {
              id: true,
              floor: {
                select: {
                  buildingId: true,
                  building: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  },
};

function readingEvent(reading) {
  const building = reading.sensor.device.room.zone.floor.building;

  return {
    id: String(reading.id),
    sensorId: reading.sensorId,
    deviceId: reading.sensor.deviceId,
    buildingId: building.id,
    value: String(reading.value),
    unit: reading.sensor.unit,
    recordedAt: reading.recordedAt,
    outOfRange: reading.outOfRange,
  };
}

function alarmEvent(alarm, sensor) {
  const building = sensor.device.room.zone.floor.building;

  return {
    id: alarm.id,
    type: alarm.type,
    severity: alarm.severity,
    status: alarm.status,
    message: alarm.message,
    deviceId: sensor.device.id,
    buildingId: building.id,
    sensorId: sensor.id,
    triggeredAt: alarm.triggeredAt,
    acknowledgedAt: alarm.acknowledgedAt || null,
    resolvedAt: alarm.resolvedAt || null,
    previousStatus: alarm.previousStatus || null,
    device: { id: sensor.device.id, name: sensor.device.name },
    building: { id: building.id, name: building.name },
  };
}

async function create(input) {
  const outcome = await prisma.$transaction(async (tx) => {
    const sensor = await tx.sensor.findUnique({
      where: { id: input.sensorId },
      include: evaluationInclude,
    });
    assertFound(sensor, 'Sensor not found');

    const reading = await tx.deviceReading.create({
      data: {
        sensorId: input.sensorId,
        value: input.value,
        recordedAt: input.recordedAt || new Date(),
      },
      include: { sensor: sensorInclude },
    });

    const evaluated = await applyReading(tx, sensor, reading);

    return {
      reading: {
        ...decorate(reading),
        alarm: evaluated.alarm,
      },
      sensor,
      effects: evaluated.effects,
    };
  });

  realtime.emitReadingCreated(readingEvent(outcome.reading));
  outcome.effects.forEach((effect) => {
    const payload = alarmEvent(
      { ...effect.alarm, previousStatus: effect.previousStatus || null },
      outcome.sensor,
    );

    if (effect.kind === 'created') {
      realtime.emitAlarmCreated(payload);
    }

    if (effect.kind === 'resolved') {
      realtime.emitAlarmResolved(payload);
    }
  });

  return outcome.reading;
}

module.exports = { list, getById, create };
