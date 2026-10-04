const { loadEnv } = require('./config/env');
const { prisma, checkDatabase } = require('./db/prisma');
const { createApp } = require('./app');

async function start() {
  const env = loadEnv();

  try {
    const connected = await checkDatabase();

    if (!connected) {
      throw new Error('PostgreSQL responded without the expected result');
    }

    console.log('Connected to PostgreSQL through Prisma');
  } catch (error) {
    console.error('PostgreSQL connection failed:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }

  const app = createApp({ env });
  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`BMS API listening on port ${env.port}`);
  });

  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`${signal} received, shutting down`);

    server.close(async () => {
      try {
        await prisma.$disconnect();
      } catch (error) {
        console.error('Failed to close Prisma client:', error.message);
      }

      process.exit(0);
    });
  }

  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
}

start().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
