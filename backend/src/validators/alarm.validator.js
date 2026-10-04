const { paginationQuery, idParams, ALARM_SEVERITIES, ALARM_STATUSES, text } = require('./common');

const fields = {
  deviceId: { type: 'uuid' },
  buildingId: { type: 'uuid' },
  zoneId: { type: 'uuid', nullable: true },
  type: text({ minLength: 1, maxLength: 80 }),
  severity: { type: 'enum', values: ALARM_SEVERITIES },
  message: text({ minLength: 1, maxLength: 2000 }),
  status: { type: 'enum', values: ALARM_STATUSES },
  triggeredAt: { type: 'datetime' },
  acknowledgedAt: { type: 'datetime', nullable: true },
  resolvedAt: { type: 'datetime', nullable: true },
};

const list = {
  query: {
    ...paginationQuery,
    status: { type: 'enum', values: ALARM_STATUSES },
    severity: { type: 'enum', values: ALARM_SEVERITIES },
    buildingId: { type: 'uuid' },
  },
};

const byId = {
  params: idParams,
};

const create = {
  body: {
    deviceId: { ...fields.deviceId, required: true },
    buildingId: { ...fields.buildingId, required: true },
    zoneId: fields.zoneId,
    type: { ...fields.type, required: true },
    severity: { ...fields.severity, required: true },
    message: { ...fields.message, required: true },
    status: fields.status,
    triggeredAt: { ...fields.triggeredAt, required: true },
    acknowledgedAt: fields.acknowledgedAt,
    resolvedAt: fields.resolvedAt,
  },
};

const update = {
  params: idParams,
  body: fields,
  requireAny: [
    'deviceId',
    'buildingId',
    'zoneId',
    'type',
    'severity',
    'message',
    'status',
    'triggeredAt',
    'acknowledgedAt',
    'resolvedAt',
  ],
};

module.exports = { list, byId, create, update };
