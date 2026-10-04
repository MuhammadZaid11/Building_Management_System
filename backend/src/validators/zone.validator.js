const { paginationQuery, idParams, text } = require('./common');

const fields = {
  floorId: { type: 'uuid' },
  name: text({ minLength: 1, maxLength: 150 }),
  code: text({ minLength: 1, maxLength: 50 }),
  description: text({ maxLength: 2000, nullable: true }),
};

const list = {
  query: {
    ...paginationQuery,
    floorId: { type: 'uuid' },
  },
};

const byId = {
  params: idParams,
};

const create = {
  body: {
    floorId: { ...fields.floorId, required: true },
    name: { ...fields.name, required: true },
    code: { ...fields.code, required: true },
    description: fields.description,
  },
};

const update = {
  params: idParams,
  body: fields,
  requireAny: ['floorId', 'name', 'code', 'description'],
};

module.exports = { list, byId, create, update };
