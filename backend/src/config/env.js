const REQUIRED_VARIABLES = ['PORT', 'DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

function loadEnv() {
  const missing = REQUIRED_VARIABLES.filter((name) => {
    const value = process.env[name];
    return value === undefined || value.trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  const port = Number(process.env.PORT);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    nodeEnv,
    port,
    databaseUrl: process.env.DATABASE_URL,
    frontendUrl: resolveFrontendUrl(nodeEnv),
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  };
}

function resolveFrontendUrl(nodeEnv) {
  const configured = (process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || '').trim();

  if (configured) {
    return configured;
  }

  if (nodeEnv !== 'production') {
    return 'http://localhost:5173';
  }

  return '';
}

function energySettings() {
  const rawCost = (process.env.ENERGY_COST_PER_KWH ?? '').trim();
  const costPerKwh = rawCost === '' ? 0.25 : Number(rawCost);

  if (!Number.isFinite(costPerKwh) || costPerKwh < 0) {
    throw new Error('ENERGY_COST_PER_KWH must be a non-negative number');
  }

  const currency = (process.env.CURRENCY_CODE || 'USD').trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error('CURRENCY_CODE must be a 3-letter currency code');
  }

  const rawTarget = (process.env.ENERGY_DAILY_TARGET_KWH ?? '').trim();
  let dailyTargetKwh = null;

  if (rawTarget !== '') {
    dailyTargetKwh = Number(rawTarget);

    if (!Number.isFinite(dailyTargetKwh) || dailyTargetKwh < 0) {
      throw new Error('ENERGY_DAILY_TARGET_KWH must be a non-negative number');
    }
  }

  return { costPerKwh, currency, dailyTargetKwh };
}

module.exports = { loadEnv, energySettings };
