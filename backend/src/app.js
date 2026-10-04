const express = require('express');
const helmet = require('helmet');
const { loadEnv } = require('./config/env');
const { createCorsMiddleware } = require('./middleware/cors.middleware');
const { notFoundHandler } = require('./middleware/notFound.middleware');
const { errorHandler } = require('./middleware/error.middleware');
const { createHealthRouter } = require('./routes/health');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const buildingRoutes = require('./routes/building.routes');
const floorRoutes = require('./routes/floor.routes');
const zoneRoutes = require('./routes/zone.routes');
const roomRoutes = require('./routes/room.routes');
const deviceRoutes = require('./routes/device.routes');
const sensorRoutes = require('./routes/sensor.routes');
const readingRoutes = require('./routes/reading.routes');
const alarmRoutes = require('./routes/alarm.routes');

function createApp(options = {}) {
  const env = options.env || loadEnv();
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(createCorsMiddleware(options.frontendUrl ?? env.frontendUrl));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', createHealthRouter());
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/buildings', buildingRoutes);
  app.use('/api/v1/floors', floorRoutes);
  app.use('/api/v1/zones', zoneRoutes);
  app.use('/api/v1/rooms', roomRoutes);
  app.use('/api/v1/devices', deviceRoutes);
  app.use('/api/v1/sensors', sensorRoutes);
  app.use('/api/v1/readings', readingRoutes);
  app.use('/api/v1/alarms', alarmRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
