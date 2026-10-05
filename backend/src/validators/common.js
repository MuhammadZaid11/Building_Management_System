const paginationQuery = {
  page: { type: 'int', min: 1, default: 1 },
  limit: { type: 'int', min: 1, max: 100, default: 20 },
};

const idParams = {
  id: { type: 'uuid', required: true },
};

const RECORD_STATUSES = ['ACTIVE', 'INACTIVE'];

const DEVICE_STATUSES = ['ONLINE', 'OFFLINE', 'MAINTENANCE', 'DISABLED'];

const DEVICE_TYPES = [
  'HVAC',
  'LIGHT',
  'ENERGY_METER',
  'TEMPERATURE_SENSOR',
  'HUMIDITY_SENSOR',
  'SMOKE_SENSOR',
  'MOTION_SENSOR',
  'WATER_LEAK_SENSOR',
];

const SENSOR_TYPES = [
  'TEMPERATURE',
  'HUMIDITY',
  'SMOKE',
  'MOTION',
  'WATER_LEAK',
  'ENERGY',
  'POWER',
  'VOLTAGE',
  'CURRENT',
  'PRESSURE',
];

const SENSOR_UNITS = {
  TEMPERATURE: ['°C', '°F'],
  HUMIDITY: ['%'],
  SMOKE: ['ppm'],
  MOTION: ['count'],
  WATER_LEAK: ['state'],
  ENERGY: ['kWh', 'Wh'],
  POWER: ['kW', 'W'],
  VOLTAGE: ['V'],
  CURRENT: ['A'],
  PRESSURE: ['Pa', 'kPa'],
};

const ALARM_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const ALARM_STATUSES = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'];

const ALARM_TYPES = [
  'TEMPERATURE_HIGH',
  'TEMPERATURE_LOW',
  'HUMIDITY_HIGH',
  'HUMIDITY_LOW',
  'SMOKE_DETECTED',
  'WATER_LEAK',
  'SENSOR_OUT_OF_RANGE',
  'DEVICE_OFFLINE',
  'ENERGY_THRESHOLD',
];

function text(options = {}) {
  return { type: 'string', ...options };
}

function assertSensorUnit(sensorType, unit, errors, field = 'body.unit') {
  if (!sensorType || unit === undefined || unit === null) {
    return;
  }

  const allowed = SENSOR_UNITS[sensorType] || [];

  if (!allowed.includes(unit)) {
    errors.push({
      field,
      message: `unit must be one of: ${allowed.join(', ')}`,
    });
  }
}

function compareDecimals(minValue, maxValue, errors) {
  if (
    minValue !== undefined &&
    minValue !== null &&
    maxValue !== undefined &&
    maxValue !== null &&
    Number(minValue) > Number(maxValue)
  ) {
    errors.push({
      field: 'body.minValue',
      message: 'minValue must be less than or equal to maxValue',
    });
  }
}

module.exports = {
  paginationQuery,
  idParams,
  RECORD_STATUSES,
  DEVICE_STATUSES,
  DEVICE_TYPES,
  SENSOR_TYPES,
  SENSOR_UNITS,
  ALARM_SEVERITIES,
  ALARM_STATUSES,
  ALARM_TYPES,
  text,
  compareDecimals,
  assertSensorUnit,
};
