const { prisma } = require('../db/prisma');

function toPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

async function findPage(model, { where = {}, orderBy, include, select, page, limit }) {
  const query = {
    where,
    orderBy,
    skip: (page - 1) * limit,
    take: limit,
  };

  if (include) {
    query.include = include;
  }

  if (select) {
    query.select = select;
  }

  const [data, total] = await prisma.$transaction([
    model.findMany(query),
    model.count({ where }),
  ]);

  return {
    data,
    pagination: toPagination(page, limit, total),
  };
}

module.exports = { toPagination, findPage };
