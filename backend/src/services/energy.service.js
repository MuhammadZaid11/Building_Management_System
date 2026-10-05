const { Prisma } = require('@prisma/client');
const { prisma } = require('../db/prisma');
const { energySettings } = require('../config/env');
const { ApiError, assertFound } = require('../utils/apiError');
const { locationSelect } = require('./device.service');
const {
  round,
  toKwh,
  toKw,
  estimateFromPower,
  comparePeriods,
  costFor,
} = require('../utils/energyMath');

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;
const ENERGY_TYPES = ['ENERGY', 'POWER', 'VOLTAGE', 'CURRENT'];
const PERIOD_FORMAT = {
  hour: 'YYYY-MM-DD"T"HH24:00:00"Z"',
  day: 'YYYY-MM-DD',
  week: 'IYYY-"W"IW',
  month: 'YYYY-MM',
};

function windowFor(query) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (from > to) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Validation failed', [
      { field: 'query.from', message: 'from must be earlier than or equal to to' },
    ]);
  }

  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Validation failed', [
      { field: 'query.to', message: 'The selected range cannot exceed 366 days' },
    ]);
  }

  return { from, to };
}

function previousWindow(from, to) {
  const duration = to.getTime() - from.getTime();
  const previousTo = new Date(from.getTime() - 1);
  return { from: new Date(previousTo.getTime() - duration), to: previousTo };
}

function windowDays(from, to) {
  const days = (to.getTime() - from.getTime()) / 86400000;
  return days > 0 ? days : 1;
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function assertBuilding(buildingId) {
  if (!buildingId) {
    return;
  }

  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { id: true },
  });
  assertFound(building, 'Building not found');
}

function sensorFilter(query) {
  const where = { sensorType: { in: ENERGY_TYPES } };

  if (query.sensorId) {
    where.id = query.sensorId;
  }

  if (query.deviceId) {
    where.deviceId = query.deviceId;
  }

  if (query.buildingId) {
    where.device = { room: { zone: { floor: { buildingId: query.buildingId } } } };
  }

  return where;
}

async function loadSensors(query) {
  return prisma.sensor.findMany({
    where: sensorFilter(query),
    select: {
      id: true,
      name: true,
      sensorType: true,
      unit: true,
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
    orderBy: [{ deviceId: 'asc' }, { name: 'asc' }],
  });
}

function orderedDeltas(sensorIds, from, to) {
  return Prisma.sql`
    WITH ordered AS (
      SELECT
        r.sensor_id,
        r.recorded_at,
        CASE WHEN s.unit = 'Wh' THEN r.value / 1000 ELSE r.value END
          - LAG(CASE WHEN s.unit = 'Wh' THEN r.value / 1000 ELSE r.value END)
            OVER (PARTITION BY r.sensor_id ORDER BY r.recorded_at, r.id) AS delta
      FROM device_readings r
      INNER JOIN sensors s ON s.id = r.sensor_id
      WHERE r.sensor_id IN (${Prisma.join(sensorIds.map((id) => Prisma.sql`${id}::uuid`))})
        AND s.sensor_type = 'ENERGY'
        AND r.recorded_at >= ${from}
        AND r.recorded_at <= ${to}
    )
  `;
}

async function totalsBySensor(sensorIds, from, to) {
  const totals = new Map();

  if (sensorIds.length === 0) {
    return totals;
  }

  const rows = await prisma.$queryRaw`
    ${orderedDeltas(sensorIds, from, to)}
    SELECT
      sensor_id AS "sensorId",
      COALESCE(SUM(CASE WHEN delta >= 0 THEN delta ELSE 0 END), 0) AS consumption,
      COALESCE(BOOL_OR(delta < 0), false) AS reset
    FROM ordered
    WHERE delta IS NOT NULL
    GROUP BY sensor_id
  `;

  rows.forEach((row) => {
    totals.set(row.sensorId, {
      consumptionKwh: round(asNumber(row.consumption), 4),
      meterResetDetected: Boolean(row.reset),
    });
  });

  return totals;
}

function combineTotals(totals) {
  let consumptionKwh = 0;
  let meterResetDetected = false;

  totals.forEach((item) => {
    consumptionKwh += item.consumptionKwh;
    meterResetDetected = meterResetDetected || item.meterResetDetected;
  });

  return { consumptionKwh: round(consumptionKwh, 4), meterResetDetected };
}

async function trendBuckets(sensorIds, from, to, interval) {
  if (sensorIds.length === 0) {
    return [];
  }

  const format = PERIOD_FORMAT[interval] || PERIOD_FORMAT.day;
  const rows = await prisma.$queryRaw`
    ${orderedDeltas(sensorIds, from, to)}
    SELECT
      to_char(date_trunc(${interval}, recorded_at AT TIME ZONE 'UTC'), ${format}) AS period,
      COALESCE(SUM(CASE WHEN delta >= 0 THEN delta ELSE 0 END), 0) AS consumption,
      COALESCE(BOOL_OR(delta < 0), false) AS reset
    FROM ordered
    WHERE delta IS NOT NULL
    GROUP BY 1
    ORDER BY 1
  `;

  return rows.map((row) => ({
    period: row.period,
    consumptionKwh: round(asNumber(row.consumption), 4),
    meterResetDetected: Boolean(row.reset),
  }));
}

async function latestBySensor(sensorIds) {
  if (sensorIds.length === 0) {
    return new Map();
  }

  const readings = await prisma.deviceReading.findMany({
    where: { sensorId: { in: sensorIds } },
    distinct: ['sensorId'],
    orderBy: [{ sensorId: 'asc' }, { recordedAt: 'desc' }, { id: 'desc' }],
    select: { sensorId: true, value: true, recordedAt: true },
  });

  return new Map(readings.map((reading) => [reading.sensorId, reading]));
}

function bucketLabel(date, interval) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  if (interval === 'month') {
    return `${year}-${month}`;
  }

  if (interval === 'hour') {
    return `${year}-${month}-${day}T${String(date.getUTCHours()).padStart(2, '0')}:00:00Z`;
  }

  if (interval === 'week') {
    const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
    return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  return `${year}-${month}-${day}`;
}

async function estimatedTrend(powerSensors, from, to, interval) {
  if (powerSensors.length === 0) {
    return { consumptionKwh: 0, buckets: [] };
  }

  const readings = await prisma.deviceReading.findMany({
    where: {
      sensorId: { in: powerSensors.map((sensor) => sensor.id) },
      recordedAt: { gte: from, lte: to },
    },
    select: { sensorId: true, value: true, recordedAt: true },
    orderBy: [{ sensorId: 'asc' }, { recordedAt: 'asc' }, { id: 'asc' }],
  });
  const units = new Map(powerSensors.map((sensor) => [sensor.id, sensor.unit]));
  const grouped = new Map();
  let previous = null;

  readings.forEach((reading) => {
    const point = {
      sensorId: reading.sensorId,
      kw: toKw(reading.value, units.get(reading.sensorId)),
      recordedAt: reading.recordedAt,
    };

    if (previous && previous.sensorId === point.sensorId) {
      const sample = estimateFromPower([previous, point]);
      const label = bucketLabel(point.recordedAt, interval);
      grouped.set(label, (grouped.get(label) || 0) + sample.consumptionKwh);
    }

    previous = point;
  });

  const buckets = [...grouped.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([period, consumptionKwh]) => ({
      period,
      consumptionKwh: round(consumptionKwh, 4),
      meterResetDetected: false,
    }));

  return {
    consumptionKwh: round(buckets.reduce((sum, bucket) => sum + bucket.consumptionKwh, 0), 4),
    buckets,
  };
}

function priced(buckets, rate) {
  return buckets.map((bucket) => ({
    period: bucket.period,
    consumptionKwh: bucket.consumptionKwh,
    cost: costFor(bucket.consumptionKwh, rate),
  }));
}

async function summary(query) {
  await assertBuilding(query.buildingId);
  const settings = energySettings();
  const { from, to } = windowFor(query);
  const previous = previousWindow(from, to);
  const sensors = await loadSensors(query);
  const energySensors = sensors.filter((sensor) => sensor.sensorType === 'ENERGY');
  const powerSensors = sensors.filter((sensor) => sensor.sensorType === 'POWER');
  const energyIds = energySensors.map((sensor) => sensor.id);
  const [currentTotals, previousTotals, latest] = await Promise.all([
    totalsBySensor(energyIds, from, to),
    totalsBySensor(energyIds, previous.from, previous.to),
    latestBySensor(sensors.map((sensor) => sensor.id)),
  ]);
  const current = combineTotals(currentTotals);
  const earlier = combineTotals(previousTotals);
  const compared = comparePeriods(current.consumptionKwh, earlier.consumptionKwh);
  const days = windowDays(from, to);
  const powerLatest = powerSensors.map((sensor) => {
    const reading = latest.get(sensor.id);
    return {
      sensorId: sensor.id,
      deviceId: sensor.deviceId,
      valueKw: reading ? round(toKw(reading.value, sensor.unit), 4) : 0,
    };
  });
  const seenDevices = new Set();
  const meters = energySensors.filter((sensor) => {
    if (sensor.device.deviceType !== 'ENERGY_METER' || seenDevices.has(sensor.deviceId)) {
      return false;
    }

    seenDevices.add(sensor.deviceId);
    return true;
  }).map((sensor) => {
    const reading = latest.get(sensor.id);
    const room = sensor.device.room;
    const building = room.zone.floor.building;
    const measured = currentTotals.get(sensor.id) || { consumptionKwh: 0, meterResetDetected: false };
    return {
      deviceId: sensor.device.id,
      deviceName: sensor.device.name,
      deviceCode: sensor.device.deviceCode,
      status: sensor.device.status,
      buildingId: building.id,
      buildingName: building.name,
      roomId: room.id,
      roomName: room.name,
      sensorId: sensor.id,
      sensorName: sensor.name,
      latestValue: reading ? reading.value : null,
      latestValueKwh: reading ? toKwh(reading.value, sensor.unit) : null,
      unit: sensor.unit,
      recordedAt: reading ? reading.recordedAt : null,
      consumptionKwh: measured.consumptionKwh,
      meterResetDetected: measured.meterResetDetected,
    };
  });

  return {
    totalConsumptionKwh: current.consumptionKwh,
    estimatedCost: costFor(current.consumptionKwh, settings.costPerKwh),
    currency: settings.currency,
    ratePerKwh: settings.costPerKwh,
    dailyTargetKwh: settings.dailyTargetKwh,
    previousPeriodConsumptionKwh: earlier.consumptionKwh,
    changePercent: compared.changePercent,
    direction: compared.direction,
    differenceKwh: compared.difference,
    averageDailyKwh: round(current.consumptionKwh / days, 4),
    windowDays: round(days, 4),
    currentPowerKw: round(powerLatest.reduce((sum, item) => sum + item.valueKw, 0), 4),
    meterResetDetected: current.meterResetDetected,
    source: 'MEASURED',
    from,
    to,
    powerSensors: powerLatest,
    meters,
  };
}

async function trend(query) {
  await assertBuilding(query.buildingId);
  const settings = energySettings();
  const { from, to } = windowFor(query);
  const interval = query.interval || 'day';
  const sensors = await loadSensors(query);
  const energyIds = sensors.filter((sensor) => sensor.sensorType === 'ENERGY').map((sensor) => sensor.id);
  let source = 'MEASURED';
  let buckets = [];

  if (energyIds.length > 0) {
    buckets = await trendBuckets(energyIds, from, to, interval);
  } else {
    const power = sensors.filter((sensor) => sensor.sensorType === 'POWER');
    const estimated = await estimatedTrend(power, from, to, interval);
    buckets = estimated.buckets;
    source = power.length > 0 ? 'ESTIMATED' : 'MEASURED';
  }

  return {
    source,
    meterResetDetected: buckets.some((bucket) => bucket.meterResetDetected),
    currency: settings.currency,
    ratePerKwh: settings.costPerKwh,
    from,
    to,
    interval,
    points: priced(buckets, settings.costPerKwh),
  };
}

async function buildings(query) {
  const settings = energySettings();
  const { from, to } = windowFor(query);
  const buildingRows = await prisma.building.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const rows = await Promise.all(buildingRows.map(async (building) => {
    const sensors = await loadSensors({ buildingId: building.id });
    const totals = await totalsBySensor(
      sensors.filter((sensor) => sensor.sensorType === 'ENERGY').map((sensor) => sensor.id),
      from,
      to,
    );
    const measured = combineTotals(totals);
    return {
      buildingId: building.id,
      buildingName: building.name,
      consumptionKwh: measured.consumptionKwh,
      cost: costFor(measured.consumptionKwh, settings.costPerKwh),
      meterResetDetected: measured.meterResetDetected,
    };
  }));
  const total = rows.reduce((sum, row) => sum + row.consumptionKwh, 0);

  return {
    currency: settings.currency,
    ratePerKwh: settings.costPerKwh,
    source: 'MEASURED',
    from,
    to,
    buildings: rows.map((row) => ({
      ...row,
      percentageOfTotal: total > 0 ? round((row.consumptionKwh / total) * 100, 2) : 0,
    })),
  };
}

async function device(id, query) {
  const settings = energySettings();
  const { from, to } = windowFor(query);
  const interval = query.interval || 'day';
  const existing = await prisma.device.findUnique({
    where: { id },
    include: {
      room: locationSelect,
      sensors: { orderBy: { name: 'asc' } },
    },
  });
  assertFound(existing, 'Device not found');

  const capable = existing.sensors.filter((sensor) => ENERGY_TYPES.includes(sensor.sensorType));

  if (existing.deviceType !== 'ENERGY_METER' || capable.length === 0) {
    throw new ApiError(404, 'ENERGY_DATA_NOT_AVAILABLE', 'This device does not have energy data.');
  }

  if (query.sensorId && !capable.some((sensor) => sensor.id === query.sensorId)) {
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'Sensor not found');
  }

  const selected = query.sensorId ? capable.filter((sensor) => sensor.id === query.sensorId) : capable;
  const energy = selected.filter((sensor) => sensor.sensorType === 'ENERGY');
  const power = selected.filter((sensor) => sensor.sensorType === 'POWER');
  const latest = await latestBySensor(selected.map((sensor) => sensor.id));
  let source = 'UNAVAILABLE';
  let consumptionKwh = null;
  let meterResetDetected = false;
  let buckets = [];

  if (energy.length > 0) {
    const totals = await totalsBySensor(energy.map((sensor) => sensor.id), from, to);
    const measured = combineTotals(totals);
    consumptionKwh = measured.consumptionKwh;
    meterResetDetected = measured.meterResetDetected;
    buckets = await trendBuckets(energy.map((sensor) => sensor.id), from, to, interval);
    source = 'MEASURED';
  } else if (power.length > 0) {
    const estimated = await estimatedTrend(power, from, to, interval);
    consumptionKwh = estimated.consumptionKwh;
    buckets = estimated.buckets;
    source = 'ESTIMATED';
  }

  const room = existing.room;
  const building = room.zone.floor.building;

  return {
    device: {
      id: existing.id,
      name: existing.name,
      deviceCode: existing.deviceCode,
      deviceType: existing.deviceType,
      status: existing.status,
      buildingId: building.id,
      buildingName: building.name,
      roomId: room.id,
      roomName: room.name,
    },
    source,
    consumptionKwh,
    estimatedCost: costFor(consumptionKwh, settings.costPerKwh),
    currency: settings.currency,
    ratePerKwh: settings.costPerKwh,
    meterResetDetected,
    currentPowerKw: round(power.reduce((sum, sensor) => {
      const reading = latest.get(sensor.id);
      return sum + (reading ? toKw(reading.value, sensor.unit) : 0);
    }, 0), 4),
    from,
    to,
    interval,
    trend: priced(buckets, settings.costPerKwh),
    sensors: selected.map((sensor) => {
      const reading = latest.get(sensor.id);
      return {
        id: sensor.id,
        name: sensor.name,
        sensorType: sensor.sensorType,
        unit: sensor.unit,
        latestValue: reading ? reading.value : null,
        recordedAt: reading ? reading.recordedAt : null,
      };
    }),
  };
}

async function compare(query) {
  await assertBuilding(query.buildingId);
  const settings = energySettings();
  const { from, to } = windowFor(query);
  const previous = previousWindow(from, to);
  const sensors = await loadSensors(query);
  const energyIds = sensors.filter((sensor) => sensor.sensorType === 'ENERGY').map((sensor) => sensor.id);
  const [currentTotals, previousTotals] = await Promise.all([
    totalsBySensor(energyIds, from, to),
    totalsBySensor(energyIds, previous.from, previous.to),
  ]);
  const current = combineTotals(currentTotals);
  const earlier = combineTotals(previousTotals);
  const compared = comparePeriods(current.consumptionKwh, earlier.consumptionKwh);

  return {
    currentConsumptionKwh: current.consumptionKwh,
    previousConsumptionKwh: earlier.consumptionKwh,
    currentCost: costFor(current.consumptionKwh, settings.costPerKwh),
    previousCost: costFor(earlier.consumptionKwh, settings.costPerKwh),
    differenceKwh: compared.difference,
    changePercent: compared.changePercent,
    direction: compared.direction,
    currency: settings.currency,
    ratePerKwh: settings.costPerKwh,
    meterResetDetected: current.meterResetDetected || earlier.meterResetDetected,
    source: 'MEASURED',
    currentFrom: from,
    currentTo: to,
    previousFrom: previous.from,
    previousTo: previous.to,
  };
}

module.exports = { summary, trend, buildings, device, compare };
