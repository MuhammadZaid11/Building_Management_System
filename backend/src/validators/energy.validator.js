const { idParams } = require('./common');

const range = {
  buildingId: { type: 'uuid' },
  from: { type: 'datetime' },
  to: { type: 'datetime' },
};

const summary = { query: range };

const trend = {
  query: {
    ...range,
    deviceId: { type: 'uuid' },
    sensorId: { type: 'uuid' },
    interval: { type: 'enum', values: ['hour', 'day', 'week', 'month'] },
  },
};

const buildings = { query: range };

const device = {
  params: idParams,
  query: {
    from: { type: 'datetime' },
    to: { type: 'datetime' },
    sensorId: { type: 'uuid' },
    interval: { type: 'enum', values: ['hour', 'day', 'week', 'month'] },
  },
};

const compare = { query: range };

module.exports = { summary, trend, buildings, device, compare };
