const { paginationQuery } = require('./common');

const list = {
  query: {
    ...paginationQuery,
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
  params: {
    id: { type: 'readingId', required: true },
  },
};

const create = {
  body: {
    sensorId: { type: 'uuid', required: true },
    value: { type: 'decimal', required: true },
    recordedAt: { type: 'datetime' },
  },
};

module.exports = { list, byId, create };
