const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

const filters = {
  query: {
    buildingId: { type: 'uuid' },
    deviceId: { type: 'uuid' },
    from: { type: 'datetime' },
    to: { type: 'datetime' },
    interval: { type: 'enum', values: ['hour', 'day', 'week', 'month'] },
  },
  refine(validated, errors) {
    const { from, to } = validated.query;

    if (from && to && from > to) {
      errors.push({ field: 'query.from', message: 'from must be earlier than or equal to to' });
    }

    if (from && to && to.getTime() - from.getTime() > MAX_RANGE_MS) {
      errors.push({ field: 'query.to', message: 'The selected range cannot exceed 366 days' });
    }
  },
};

module.exports = { filters };
