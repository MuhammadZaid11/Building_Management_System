const { Prisma } = require('@prisma/client');
const { prisma } = require('../db/prisma');
const { assertFound } = require('../utils/apiError');
const { isOutOfRange } = require('../utils/sensorReadings');
const { costSummary } = require('../utils/maintenance');
const energyService = require('./energy.service');
const maintenanceService = require('./maintenance.service');
const {
  WEIGHTS,
  STATUS_THRESHOLDS,
  deviceAvailability,
  alarmCondition,
  maintenanceCondition,
  sensorHealth,
  operationalHealth,
} = require('../utils/reportHealth');

const INTERVALS = new Set(['hour', 'day', 'week', 'month']);
const OPEN_WORK = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'];
const PERIOD_FORMAT = {
  hour: 'YYYY-MM-DD"T"HH24:00:00"Z"',
  day: 'YYYY-MM-DD',
  week: 'IYYY-"W"IW',
  month: 'YYYY-MM',
};

function intervalFor(value) {
  return INTERVALS.has(value) ? value : 'day';
}

function deviceScope(buildingId) {
  if (!buildingId) {
    return {};
  }

  return { room: { zone: { floor: { buildingId } } } };
}

function buildingIdOfDevice(device) {
  return device.room?.zone?.floor?.buildingId || null;
}

async function scopedBuildings(buildingId) {
  if (!buildingId) {
    return prisma.building.findMany({
      select: { id: true, name: true, status: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { id: true, name: true, status: true },
  });
  return [assertFound(building, 'Building not found')];
}

function hasThreshold(sensor) {
  return (sensor.minValue !== null && sensor.minValue !== undefined)
    || (sensor.maxValue !== null && sensor.maxValue !== undefined);
}

function emptyStatusCounts() {
  return { total: 0, online: 0, offline: 0, maintenance: 0, disabled: 0 };
}

function addStatus(bucket, status) {
  bucket.total += 1;
  if (status === 'ONLINE') bucket.online += 1;
  if (status === 'OFFLINE') bucket.offline += 1;
  if (status === 'MAINTENANCE') bucket.maintenance += 1;
  if (status === 'DISABLED') bucket.disabled += 1;
}

function withAvailability(bucket) {
  return {
    ...bucket,
    availabilityPercent: deviceAvailability({ total: bucket.total, online: bucket.online }),
  };
}

async function loadDevices(buildingId) {
  return prisma.device.findMany({
    where: deviceScope(buildingId),
    select: {
      id: true,
      name: true,
      status: true,
      deviceType: true,
      room: {
        select: {
          zone: {
            select: {
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
  });
}

async function loadSensorSignals(buildingId) {
  const sensors = await prisma.sensor.findMany({
    where: { device: deviceScope(buildingId) },
    select: {
      id: true,
      minValue: true,
      maxValue: true,
      device: {
        select: {
          room: { select: { zone: { select: { floor: { select: { buildingId: true } } } } } },
        },
      },
    },
  });
  const ids = sensors.map((sensor) => sensor.id);
  const readings = ids.length === 0
    ? []
    : await prisma.deviceReading.findMany({
      where: { sensorId: { in: ids } },
      distinct: ['sensorId'],
      orderBy: [{ sensorId: 'asc' }, { recordedAt: 'desc' }, { id: 'desc' }],
      select: { sensorId: true, value: true },
    });
  const latest = new Map(readings.map((reading) => [reading.sensorId, reading]));

  return sensors.map((sensor) => {
    const reading = latest.get(sensor.id);
    const evaluable = hasThreshold(sensor) && Boolean(reading);
    const outOfRange = evaluable && isOutOfRange(reading.value, sensor.minValue, sensor.maxValue);
    return {
      buildingId: sensor.device.room.zone.floor.buildingId,
      evaluable,
      outOfRange,
    };
  });
}

function sensorTotals(signals) {
  const evaluated = signals.filter((signal) => signal.evaluable);
  return {
    total: signals.length,
    healthy: evaluated.filter((signal) => !signal.outOfRange).length,
    outOfRange: evaluated.filter((signal) => signal.outOfRange).length,
    evaluated: evaluated.length,
  };
}

async function deviceStatus(query) {
  const buildings = await scopedBuildings(query.buildingId);
  const devices = await loadDevices(query.buildingId);
  const overall = emptyStatusCounts();
  const byType = new Map();
  const byBuilding = new Map(buildings.map((building) => [building.id, {
    buildingId: building.id,
    buildingName: building.name,
    ...emptyStatusCounts(),
  }]));
  const offlineDevices = [];

  devices.forEach((device) => {
    addStatus(overall, device.status);
    const typeBucket = byType.get(device.deviceType) || { deviceType: device.deviceType, ...emptyStatusCounts() };
    addStatus(typeBucket, device.status);
    byType.set(device.deviceType, typeBucket);
    const buildingId = buildingIdOfDevice(device);
    const buildingBucket = byBuilding.get(buildingId);
    if (buildingBucket) {
      addStatus(buildingBucket, device.status);
    }
    if (device.status === 'OFFLINE' && offlineDevices.length < 10) {
      offlineDevices.push({
        id: device.id,
        name: device.name,
        buildingId,
        buildingName: device.room?.zone?.floor?.building?.name || null,
      });
    }
  });

  return {
    overall: withAvailability(overall),
    byType: [...byType.values()].map(withAvailability).sort((left, right) => left.deviceType.localeCompare(right.deviceType)),
    byBuilding: [...byBuilding.values()].map(withAvailability),
    offlineDevices,
  };
}

async function maintenanceContext(buildingIds) {
  if (buildingIds.length === 0) return new Map();
  const [orders, schedules] = await Promise.all([
    prisma.workOrder.groupBy({
      by: ['buildingId', 'status', 'priority'],
      where: { buildingId: { in: buildingIds } },
      _count: { _all: true },
    }),
    prisma.maintenanceSchedule.findMany({
      where: {
        device: { room: { zone: { floor: { buildingId: { in: buildingIds } } } } },
      },
      select: {
        isActive: true,
        nextDueAt: true,
        device: { select: { room: { select: { zone: { select: { floor: { select: { buildingId: true } } } } } } } },
      },
    }),
  ]);
  const now = Date.now();
  const byBuilding = new Map(buildingIds.map((id) => [id, {
    workOrderCount: 0,
    scheduleCount: 0,
    overdue: 0,
    criticalOpen: 0,
    otherOpen: 0,
    openMaintenance: 0,
  }]));

  orders.forEach((row) => {
    const bucket = byBuilding.get(row.buildingId);
    if (!bucket) return;
    bucket.workOrderCount += row._count._all;
    if (OPEN_WORK.includes(row.status)) {
      bucket.openMaintenance += row._count._all;
      if (row.priority === 'CRITICAL') bucket.criticalOpen += row._count._all;
      else bucket.otherOpen += row._count._all;
    }
  });

  schedules.forEach((schedule) => {
    const buildingId = schedule.device.room.zone.floor.buildingId;
    const bucket = byBuilding.get(buildingId);
    if (!bucket) return;
    bucket.scheduleCount += 1;
    if (schedule.isActive && new Date(schedule.nextDueAt).getTime() <= now) {
      bucket.overdue += 1;
    }
  });

  return byBuilding;
}

async function activeAlarmContext(buildingIds) {
  if (buildingIds.length === 0) return new Map();
  const rows = await prisma.alarm.groupBy({
    by: ['buildingId', 'severity'],
    where: { status: 'ACTIVE', buildingId: { in: buildingIds } },
    _count: { _all: true },
  });
  const byBuilding = new Map(buildingIds.map((id) => [id, { critical: 0, high: 0, medium: 0, low: 0, active: 0 }]));

  rows.forEach((row) => {
    const bucket = byBuilding.get(row.buildingId);
    if (!bucket) return;
    const key = row.severity.toLowerCase();
    bucket[key] += row._count._all;
    bucket.active += row._count._all;
  });

  return byBuilding;
}

async function buildingHealth(query) {
  const buildings = await scopedBuildings(query.buildingId);
  const ids = buildings.map((building) => building.id);
  const [devices, signals, alarms, maintenance] = await Promise.all([
    loadDevices(query.buildingId),
    loadSensorSignals(query.buildingId),
    activeAlarmContext(ids),
    maintenanceContext(ids),
  ]);
  const devicesByBuilding = new Map(ids.map((id) => [id, emptyStatusCounts()]));
  devices.forEach((device) => {
    const bucket = devicesByBuilding.get(buildingIdOfDevice(device));
    if (bucket) addStatus(bucket, device.status);
  });

  return {
    formula: {
      description: 'Operational health is a dashboard score, not a certified building assessment.',
      weights: WEIGHTS,
      thresholds: STATUS_THRESHOLDS,
      alarmPenalty: 'Each active alarm reduces the alarm component: critical 25, high 10, medium 4, low 1.',
      maintenancePenalty: 'Each overdue schedule reduces the maintenance component by 20. Each open critical work order reduces it by 15, and each other open work order by 5.',
    },
    buildings: buildings.map((building) => {
      const deviceCounts = devicesByBuilding.get(building.id) || emptyStatusCounts();
      const alarmCounts = alarms.get(building.id) || { critical: 0, high: 0, medium: 0, low: 0 };
      const maintenanceCounts = maintenance.get(building.id) || {
        scheduleCount: 0, workOrderCount: 0, overdue: 0, criticalOpen: 0, otherOpen: 0,
      };
      const buildingSignals = signals.filter((signal) => signal.buildingId === building.id);
      const evaluated = buildingSignals.filter((signal) => signal.evaluable);
      const components = {
        deviceAvailability: deviceAvailability({ total: deviceCounts.total, online: deviceCounts.online }),
        alarmCondition: alarmCondition({ deviceCount: deviceCounts.total, ...alarmCounts }),
        maintenanceCondition: maintenanceCondition(maintenanceCounts),
        sensorHealth: sensorHealth({
          evaluated: evaluated.length,
          healthy: evaluated.filter((signal) => !signal.outOfRange).length,
        }),
      };
      const health = operationalHealth(components);
      return {
        buildingId: building.id,
        buildingName: building.name,
        score: health.score,
        status: health.status,
        components,
      };
    }),
  };
}

async function alarmTrends(query) {
  const interval = intervalFor(query.interval);
  const format = PERIOD_FORMAT[interval];
  const buildingClause = query.buildingId
    ? Prisma.sql`AND building_id = ${query.buildingId}::uuid`
    : Prisma.empty;
  const [trend, summaryRows, typeRows, alarms] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        to_char(date_trunc(${interval}, triggered_at AT TIME ZONE 'UTC'), ${format}) AS period,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE severity = 'CRITICAL')::int AS critical,
        COUNT(*) FILTER (WHERE severity = 'HIGH')::int AS high,
        COUNT(*) FILTER (WHERE severity = 'MEDIUM')::int AS medium,
        COUNT(*) FILTER (WHERE severity = 'LOW')::int AS low
      FROM alarms
      WHERE triggered_at >= ${query.from} AND triggered_at <= ${query.to}
      ${buildingClause}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.alarm.groupBy({
      by: ['status'],
      where: {
        triggeredAt: { gte: query.from, lte: query.to },
        ...(query.buildingId ? { buildingId: query.buildingId } : {}),
      },
      _count: { _all: true },
    }),
    prisma.alarm.groupBy({
      by: ['type'],
      where: {
        triggeredAt: { gte: query.from, lte: query.to },
        ...(query.buildingId ? { buildingId: query.buildingId } : {}),
      },
      _count: { _all: true },
    }),
    prisma.alarm.findMany({
      where: {
        triggeredAt: { gte: query.from, lte: query.to },
        ...(query.buildingId ? { buildingId: query.buildingId } : {}),
      },
      orderBy: [{ triggeredAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: {
        id: true,
        type: true,
        severity: true,
        status: true,
        message: true,
        triggeredAt: true,
        acknowledgedAt: true,
        resolvedAt: true,
        device: { select: { id: true, name: true } },
        building: { select: { id: true, name: true } },
      },
    }),
  ]);
  const summary = { total: 0, active: 0, acknowledged: 0, resolved: 0 };
  summaryRows.forEach((row) => {
    summary.total += row._count._all;
    if (row.status === 'ACTIVE') summary.active = row._count._all;
    if (row.status === 'ACKNOWLEDGED') summary.acknowledged = row._count._all;
    if (row.status === 'RESOLVED') summary.resolved = row._count._all;
  });

  return {
    from: query.from,
    to: query.to,
    interval,
    summary,
    trend: trend.map((row) => ({
      date: row.period,
      total: Number(row.total),
      critical: Number(row.critical),
      high: Number(row.high),
      medium: Number(row.medium),
      low: Number(row.low),
    })),
    byType: typeRows
      .map((row) => ({ type: row.type, count: row._count._all }))
      .sort((left, right) => right.count - left.count),
    alarms,
  };
}

async function energyTrends(query) {
  const energyQuery = {
    buildingId: query.buildingId,
    deviceId: query.deviceId,
    from: query.from,
    to: query.to,
    interval: intervalFor(query.interval),
  };
  const [summary, trend, buildings] = await Promise.all([
    energyService.summary(energyQuery),
    energyService.trend(energyQuery),
    energyService.buildings({ from: query.from, to: query.to }),
  ]);
  const buildingRows = query.buildingId
    ? buildings.buildings.filter((building) => building.buildingId === query.buildingId)
    : buildings.buildings;
  const topDevices = [...(summary.meters || [])]
    .sort((left, right) => right.consumptionKwh - left.consumptionKwh)
    .slice(0, 5)
    .map((meter) => ({
      deviceId: meter.deviceId,
      deviceName: meter.deviceName,
      buildingId: meter.buildingId,
      buildingName: meter.buildingName,
      consumptionKwh: meter.consumptionKwh,
    }));

  return {
    source: trend.source,
    trend: trend.points,
    summary: {
      consumptionKwh: summary.totalConsumptionKwh,
      estimatedCost: summary.estimatedCost,
      currency: summary.currency,
      previousPeriodKwh: summary.previousPeriodConsumptionKwh,
      changePercent: summary.changePercent,
      direction: summary.direction,
    },
    byBuilding: buildingRows,
    topDevices,
  };
}

async function maintenanceKpis(query) {
  const where = {
    createdAt: { gte: query.from, lte: query.to },
    ...(query.buildingId ? { buildingId: query.buildingId } : {}),
  };
  const [grouped, completedRows, orders, current, activitySum, actualSum] = await Promise.all([
    prisma.workOrder.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    prisma.workOrder.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { not: null, gte: query.from, lte: query.to },
        ...(query.buildingId ? { buildingId: query.buildingId } : {}),
      },
      select: { createdAt: true, completedAt: true },
    }),
    prisma.workOrder.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      include: {
        device: { select: { id: true, name: true } },
        building: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        activities: { select: { cost: true } },
      },
    }),
    maintenanceService.summary(),
    prisma.maintenanceActivity.aggregate({
      where: { workOrder: where },
      _sum: { cost: true },
    }),
    prisma.workOrder.aggregate({
      where,
      _sum: { actualCost: true },
    }),
  ]);
  const summary = {
    total: 0,
    open: 0,
    assigned: 0,
    inProgress: 0,
    onHold: 0,
    completed: 0,
    cancelled: 0,
    overdue: query.buildingId ? null : current.overdue,
    critical: query.buildingId ? null : current.critical,
  };
  grouped.forEach((row) => {
    summary.total += row._count._all;
    if (row.status === 'OPEN') summary.open = row._count._all;
    if (row.status === 'ASSIGNED') summary.assigned = row._count._all;
    if (row.status === 'IN_PROGRESS') summary.inProgress = row._count._all;
    if (row.status === 'ON_HOLD') summary.onHold = row._count._all;
    if (row.status === 'COMPLETED') summary.completed = row._count._all;
    if (row.status === 'CANCELLED') summary.cancelled = row._count._all;
  });

  if (query.buildingId) {
    const maintenance = await maintenanceContext([query.buildingId]);
    const bucket = maintenance.get(query.buildingId);
    summary.overdue = bucket ? bucket.overdue : 0;
    summary.critical = bucket ? bucket.criticalOpen : 0;
  }

  const denominator = summary.total - summary.cancelled;
  const completionRate = summary.total === 0 || denominator <= 0
    ? null
    : Math.round((summary.completed / denominator) * 1000) / 10;
  const timed = completedRows.filter((order) => order.createdAt && order.completedAt);
  const averageResolutionHours = timed.length === 0
    ? null
    : Math.round((timed.reduce((sum, order) => sum + (order.completedAt.getTime() - order.createdAt.getTime()), 0) / timed.length / 3600000) * 100) / 100;
  const totalCost = summary.total === 0
    ? null
    : Math.round(((Number(activitySum._sum.cost) || 0) + (Number(actualSum._sum.actualCost) || 0)) * 100) / 100;

  return {
    from: query.from,
    to: query.to,
    summary,
    completionRate,
    averageResolutionHours,
    totalCost,
    workOrders: orders.map((order) => ({
      id: order.id,
      workOrderNumber: order.workOrderNumber,
      title: order.title,
      status: order.status,
      priority: order.priority,
      device: order.device,
      building: order.building,
      assignedTo: order.assignedTo,
      scheduledAt: order.scheduledAt,
      completedAt: order.completedAt,
      totalCost: costSummary(order, order.activities).totalCost,
    })),
  };
}

async function buildingComparison(query) {
  const [health, devices, energy, alarms, maintenance] = await Promise.all([
    buildingHealth(query),
    deviceStatus(query),
    energyService.buildings({ from: query.from, to: query.to }),
    activeAlarmContext((await scopedBuildings(query.buildingId)).map((building) => building.id)),
    maintenanceContext((await scopedBuildings(query.buildingId)).map((building) => building.id)),
  ]);
  const deviceMap = new Map(devices.byBuilding.map((row) => [row.buildingId, row]));
  const energyMap = new Map(energy.buildings.map((row) => [row.buildingId, row]));

  return {
    currency: energy.currency,
    buildings: health.buildings.map((building) => {
      const deviceRow = deviceMap.get(building.buildingId);
      const energyRow = energyMap.get(building.buildingId);
      const alarmRow = alarms.get(building.buildingId) || { active: 0, critical: 0 };
      const maintenanceRow = maintenance.get(building.buildingId) || { openMaintenance: 0, overdue: 0 };
      return {
        buildingId: building.buildingId,
        name: building.buildingName,
        healthScore: building.score,
        healthStatus: building.status,
        deviceCount: deviceRow ? deviceRow.total : 0,
        deviceAvailability: deviceRow ? deviceRow.availabilityPercent : null,
        activeAlarms: alarmRow.active,
        criticalAlarms: alarmRow.critical,
        energyConsumptionKwh: energyRow ? energyRow.consumptionKwh : 0,
        estimatedCost: energyRow ? energyRow.cost : 0,
        openMaintenance: maintenanceRow.openMaintenance,
        overdueMaintenance: maintenanceRow.overdue,
      };
    }),
  };
}

async function currentMaintenance(buildingIds) {
  if (buildingIds.length === 0) {
    return {
      open: 0, assigned: 0, inProgress: 0, onHold: 0, completed: 0, cancelled: 0, overdue: 0, critical: 0,
    };
  }
  const [grouped, context] = await Promise.all([
    prisma.workOrder.groupBy({
      by: ['status'],
      where: { buildingId: { in: buildingIds } },
      _count: { _all: true },
    }),
    maintenanceContext(buildingIds),
  ]);
  const summary = {
    open: 0,
    assigned: 0,
    inProgress: 0,
    onHold: 0,
    completed: 0,
    cancelled: 0,
    overdue: 0,
    critical: 0,
  };

  grouped.forEach((row) => {
    if (row.status === 'OPEN') summary.open = row._count._all;
    if (row.status === 'ASSIGNED') summary.assigned = row._count._all;
    if (row.status === 'IN_PROGRESS') summary.inProgress = row._count._all;
    if (row.status === 'ON_HOLD') summary.onHold = row._count._all;
    if (row.status === 'COMPLETED') summary.completed = row._count._all;
    if (row.status === 'CANCELLED') summary.cancelled = row._count._all;
  });

  context.forEach((bucket) => {
    summary.overdue += bucket.overdue;
    summary.critical += bucket.criticalOpen;
  });

  return summary;
}

async function executiveSummary(query) {
  const [buildings, devices, signals, healthBuildings] = await Promise.all([
    scopedBuildings(query.buildingId),
    deviceStatus(query),
    loadSensorSignals(query.buildingId),
    buildingHealth(query),
  ]);
  const sensors = sensorTotals(signals);
  const [energy, maintenance, activeAlarms] = await Promise.all([
    energyService.summary({ buildingId: query.buildingId, from: query.from, to: query.to }),
    currentMaintenance(buildings.map((building) => building.id)),
    activeAlarmContext(buildings.map((building) => building.id)),
  ]);
  const alarms = { active: 0, critical: 0, high: 0, medium: 0, low: 0 };
  activeAlarms.forEach((row) => {
    alarms.active += row.active;
    alarms.critical += row.critical;
    alarms.high += row.high;
    alarms.medium += row.medium;
    alarms.low += row.low;
  });

  return {
    from: query.from,
    to: query.to,
    buildings: {
      total: buildings.length,
      active: buildings.filter((building) => building.status === 'ACTIVE').length,
    },
    devices: devices.overall,
    sensors: {
      total: sensors.total,
      healthy: sensors.evaluated === 0 ? null : sensors.healthy,
      outOfRange: sensors.evaluated === 0 ? null : sensors.outOfRange,
    },
    alarms,
    energy: {
      consumptionKwh: energy.totalConsumptionKwh,
      estimatedCost: energy.estimatedCost,
      currency: energy.currency,
      changePercent: energy.changePercent,
    },
    maintenance,
    health: healthBuildings.buildings,
  };
}

module.exports = {
  executiveSummary,
  buildingHealth,
  deviceStatus,
  alarmTrends,
  energyTrends,
  maintenanceKpis,
  buildingComparison,
};
