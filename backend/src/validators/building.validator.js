const { paginationQuery, idParams, RECORD_STATUSES, text } = require('./common');

const fields = {
  name: text({ minLength: 1, maxLength: 150 }),
  code: text({ minLength: 1, maxLength: 50 }),
  address: text({ minLength: 1, maxLength: 300 }),
  description: text({ maxLength: 2000, nullable: true }),
  status: { type: 'enum', values: RECORD_STATUSES },
};

const list = {
  query: {
    ...paginationQuery,
    search: text({ maxLength: 100 }),
    status: { type: 'enum', values: RECORD_STATUSES },
  },
};

const byId = {
  params: idParams,
};

const create = {
  body: {
    name: { ...fields.name, required: true },
    code: { ...fields.code, required: true },
    address: { ...fields.address, required: true },
    description: fields.description,
    status: fields.status,
  },
};

const update = {
  params: idParams,
  body: fields,
  requireAny: ['name', 'code', 'address', 'description', 'status'],
};

module.exports = { list, byId, create, update };
