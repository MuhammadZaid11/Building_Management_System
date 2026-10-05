const { paginationQuery, idParams, ALARM_SEVERITIES, ALARM_STATUSES, ALARM_TYPES, text } = require('./common');

const list = {
  query: {
    ...paginationQuery,
    search: text({ maxLength: 100 }),
    status: { type: 'enum', values: ALARM_STATUSES },
    severity: { type: 'enum', values: ALARM_SEVERITIES },
    type: { type: 'enum', values: ALARM_TYPES },
    buildingId: { type: 'uuid' },
    deviceId: { type: 'uuid' },
    sensorId: { type: 'uuid' },
    from: { type: 'datetime' },
    to: { type: 'datetime' },
  },
  refine(validated, errors) {
    const { from, to } = validated.query;

    if (from && to && from > to) {
      errors.push({
        field: 'query.from',
        message: 'from must be earlier than or equal to to',
      });
    }
  },
};

const byId = {
  params: idParams,
};

module.exports = { list, byId };
