const { paginationQuery, idParams, text } = require('./common');

const fields = {
  buildingId: { type: 'uuid' },
  name: text({ minLength: 1, maxLength: 150 }),
  floorNumber: { type: 'int', min: -50, max: 200 },
  description: text({ maxLength: 2000, nullable: true }),
};

const list = {
  query: {
    ...paginationQuery,
    buildingId: { type: 'uuid' },
  },
};

const byId = {
  params: idParams,
};

const create = {
  body: {
    buildingId: { ...fields.buildingId, required: true },
    name: { ...fields.name, required: true },
    floorNumber: { ...fields.floorNumber, required: true },
    description: fields.description,
  },
};

const update = {
  params: idParams,
  body: fields,
  requireAny: ['buildingId', 'name', 'floorNumber', 'description'],
};

module.exports = { list, byId, create, update };
