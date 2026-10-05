const { prisma } = require('../db/prisma');

function isOutOfRange(value, minValue, maxValue) {
  if (value === null || value === undefined) {
    return false;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return false;
  }

  if (minValue !== null && minValue !== undefined && number < Number(minValue)) {
    return true;
  }

  if (maxValue !== null && maxValue !== undefined && number > Number(maxValue)) {
    return true;
  }

  return false;
}

function presentReading(reading, sensor) {
  if (!reading) {
    return null;
  }

  return {
    ...reading,
    outOfRange: isOutOfRange(reading.value, sensor?.minValue, sensor?.maxValue),
  };
}

async function latestReadingsBySensor(sensorIds) {
  if (sensorIds.length === 0) {
    return new Map();
  }

  const readings = await prisma.deviceReading.findMany({
    where: { sensorId: { in: sensorIds } },
    distinct: ['sensorId'],
    orderBy: [{ sensorId: 'asc' }, { recordedAt: 'desc' }, { id: 'desc' }],
  });

  return new Map(readings.map((reading) => [reading.sensorId, reading]));
}

async function attachLatestReadings(sensors) {
  const latest = await latestReadingsBySensor(sensors.map((sensor) => sensor.id));

  return sensors.map((sensor) => ({
    ...sensor,
    latestReading: presentReading(latest.get(sensor.id), sensor),
  }));
}

module.exports = { isOutOfRange, presentReading, attachLatestReadings };
