const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function checkDatabase(client = prisma) {
  const rows = await client.$queryRaw`SELECT 1 AS ok`;
  return Number(rows[0]?.ok) === 1;
}

module.exports = { prisma, checkDatabase };
