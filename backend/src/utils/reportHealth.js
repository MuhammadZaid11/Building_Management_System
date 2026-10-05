const WEIGHTS = {
  deviceAvailability: 0.4,
  alarmCondition: 0.3,
  maintenanceCondition: 0.2,
  sensorHealth: 0.1,
};

const STATUS_THRESHOLDS = [
  { min: 90, status: 'EXCELLENT' },
  { min: 75, status: 'GOOD' },
  { min: 60, status: 'WARNING' },
  { min: 0, status: 'CRITICAL' },
];

function clampScore(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function healthStatus(score) {
  if (score === null || score === undefined) {
    return null;
  }

  const match = STATUS_THRESHOLDS.find((threshold) => score >= threshold.min);
  return match ? match.status : 'CRITICAL';
}

function deviceAvailability({ total, online }) {
  if (!total) {
    return null;
  }

  return clampScore((online / total) * 100);
}

function alarmCondition({ deviceCount, critical = 0, high = 0, medium = 0, low = 0 }) {
  if (!deviceCount) {
    return null;
  }

  const penalty = critical * 25 + high * 10 + medium * 4 + low * 1;
  return clampScore(100 - penalty);
}

function maintenanceCondition({ scheduleCount, workOrderCount, overdue = 0, criticalOpen = 0, otherOpen = 0 }) {
  if (!scheduleCount && !workOrderCount) {
    return null;
  }

  const penalty = overdue * 20 + criticalOpen * 15 + otherOpen * 5;
  return clampScore(100 - penalty);
}

function sensorHealth({ evaluated, healthy }) {
  if (!evaluated) {
    return null;
  }

  return clampScore((healthy / evaluated) * 100);
}

function operationalHealth(components) {
  let usedWeight = 0;
  let weighted = 0;

  Object.entries(WEIGHTS).forEach(([key, weight]) => {
    const value = components[key];

    if (value === null || value === undefined) {
      return;
    }

    usedWeight += weight;
    weighted += value * weight;
  });

  if (usedWeight === 0) {
    return { score: null, status: null };
  }

  const score = clampScore(weighted / usedWeight);
  return { score, status: healthStatus(score) };
}

module.exports = {
  WEIGHTS,
  STATUS_THRESHOLDS,
  clampScore,
  healthStatus,
  deviceAvailability,
  alarmCondition,
  maintenanceCondition,
  sensorHealth,
  operationalHealth,
};
