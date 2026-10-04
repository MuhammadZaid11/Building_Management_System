const { paginationQuery, idParams, text, compareDecimals } = require('./common');

const fields = {
  deviceId: { type: 'uuid' },
  name: text({ minLength: 1, maxLength: 150 }),
  sensorType: text({ minLength: 1, maxLength: 80 }),
  unit: text({ minLength: 1, maxLength: 20 }),
  minValue: { type: 'decimal', nullable: true },
  maxValue: { type: 'decimal', nullable: true },
};

const list = {
  query: {
    ...paginationQuery,
    deviceId: { type: 'uuid' },
  },
};

const byId = {
  params: idParams,
};

const create = {
  body: {
    deviceId: { ...fields.deviceId, required: true },
    name: { ...fields.name, required: true },
    sensorType: { ...fields.sensorType, required: true },
    unit: { ...fields.unit, required: true },
    minValue: fields.minValue,
    maxValue: fields.maxValue,
  },
  refine(validated, errors) {
    compareDecimals(validated.body.minValue, validated.body.maxValue, errors);
  },
};

const update = {
  params: idParams,
  body: fields,
  requireAny: ['deviceId', 'name', 'sensorType', 'unit', 'minValue', 'maxValue'],
  refine(validated, errors) {
    compareDecimals(validated.body.minValue, validated.body.maxValue, errors);
  },
};

module.exports = { list, byId, create, update };
