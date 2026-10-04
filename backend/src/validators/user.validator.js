const { paginationQuery, idParams, text } = require('./common');
const { ALL_ROLES } = require('../auth/permissions');

const name = text({ maxLength: 120 });
const email = { type: 'email' };
const password = { type: 'string', minLength: 8, maxLength: 72 };
const role = { type: 'enum', values: ALL_ROLES };

const list = {
  query: paginationQuery,
};

const byId = {
  params: idParams,
};

const create = {
  body: {
    name: { ...name, required: true },
    email: { ...email, required: true },
    password: { ...password, required: true },
    role: { ...role, required: true },
  },
};

const update = {
  params: idParams,
  body: {
    name,
    email,
    password,
    role,
  },
  requireAny: ['name', 'email', 'password', 'role'],
};

const updateStatus = {
  params: idParams,
  body: {
    isActive: { type: 'boolean', required: true },
  },
};

module.exports = { list, byId, create, update, updateStatus };
