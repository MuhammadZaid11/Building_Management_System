const { paginationQuery, idParams, DEVICE_STATUSES, DEVICE_TYPES, text } = require('./common');

const fields = {
  roomId: { type: 'uuid' },
  name: text({ minLength: 1, maxLength: 150 }),
  deviceCode: text({ minLength: 1, maxLength: 80 }),
  deviceType: { type: 'enum', values: DEVICE_TYPES },
  manufacturer: text({ maxLength: 120, nullable: true }),
  model: text({ maxLength: 120, nullable: true }),
  status: { type: 'enum', values: DEVICE_STATUSES },
  installedAt: { type: 'datetime', nullable: true },
};

const list = {
  query: {
    ...paginationQuery,
    search: text({ maxLength: 100 }),
    roomId: { type: 'uuid' },
    buildingId: { type: 'uuid' },
    status: { type: 'enum', values: DEVICE_STATUSES },
    deviceType: { type: 'enum', values: DEVICE_TYPES },
  },
};

const byId = {
  params: idParams,
};

const create = {
  body: {
    roomId: { ...fields.roomId, required: true },
    name: { ...fields.name, required: true },
    deviceCode: { ...fields.deviceCode, required: true },
    deviceType: { ...fields.deviceType, required: true },
    manufacturer: fields.manufacturer,
    model: fields.model,
    status: fields.status,
    installedAt: fields.installedAt,
  },
};

const update = {
  params: idParams,
  body: fields,
  requireAny: ['roomId', 'name', 'deviceCode', 'deviceType', 'manufacturer', 'model', 'status', 'installedAt'],
};

module.exports = { list, byId, create, update };
