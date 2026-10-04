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

const ALARM_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const ALARM_STATUSES = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'];

function text(options = {}) {
  return { type: 'string', ...options };
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
  ALARM_SEVERITIES,
  ALARM_STATUSES,
  text,
  compareDecimals,
};
