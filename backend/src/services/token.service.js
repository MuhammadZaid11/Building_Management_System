const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { loadEnv } = require('../config/env');
const { prisma } = require('../db/prisma');
const { ApiError } = require('../utils/apiError');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(user) {
  const env = loadEnv();

  return jwt.sign(
    { sub: user.id, role: user.role, jti: crypto.randomUUID() },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessExpiresIn }
  );
}

function signRefreshToken(user) {
  const env = loadEnv();

  return jwt.sign({ sub: user.id, jti: crypto.randomUUID() }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
  });
}

async function storeRefreshToken(userId, refreshToken) {
  const decoded = jwt.decode(refreshToken);

  if (!decoded || typeof decoded.exp !== 'number') {
    throw new ApiError(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
  }

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(decoded.exp * 1000),
    },
  });
}

async function issueTokenPair(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await storeRefreshToken(user.id, refreshToken);
  return { accessToken, refreshToken };
}

function verifyAccessToken(token) {
  const env = loadEnv();

  try {
    return jwt.verify(token, env.jwtAccessSecret);
  } catch {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
}

function verifyRefreshToken(token) {
  const env = loadEnv();

  try {
    return jwt.verify(token, env.jwtRefreshSecret);
  } catch {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
}

module.exports = {
  hashToken,
  issueTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
};
