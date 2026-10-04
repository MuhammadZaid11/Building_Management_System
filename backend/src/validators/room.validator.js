const { paginationQuery, idParams, text } = require('./common');

const fields = {
  zoneId: { type: 'uuid' },
  name: text({ minLength: 1, maxLength: 150 }),
  roomNumber: text({ minLength: 1, maxLength: 40 }),
  description: text({ maxLength: 2000, nullable: true }),
};

const list = {
  query: {
    ...paginationQuery,
    zoneId: { type: 'uuid' },
    buildingId: { type: 'uuid' },
  },
};

const byId = {
  params: idParams,
};

const create = {
  body: {
    zoneId: { ...fields.zoneId, required: true },
    name: { ...fields.name, required: true },
    roomNumber: { ...fields.roomNumber, required: true },
    description: fields.description,
  },
};

const update = {
  params: idParams,
  body: fields,
  requireAny: ['zoneId', 'name', 'roomNumber', 'description'],
};

module.exports = { list, byId, create, update };
