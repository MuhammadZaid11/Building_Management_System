const { prisma } = require('../db/prisma');
const { ApiError } = require('../utils/apiError');
const { hashPassword, comparePassword } = require('../utils/password');
const { publicUserSelect, toPublicUser } = require('../utils/publicUser');
const { hashToken, issueTokenPair, verifyRefreshToken } = require('./token.service');

const INVALID_LOGIN = 'Invalid email or password';

let dummyHashPromise;

function dummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword('invalid-login-placeholder');
  }

  return dummyHashPromise;
}

async function rejectLogin(password) {
  await comparePassword(password, await dummyHash());
  throw new ApiError(401, 'UNAUTHORIZED', INVALID_LOGIN);
}

async function register({ name, email, password }) {
  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'VIEWER',
      },
      select: publicUserSelect,
    });

    return toPublicUser(user);
  } catch (error) {
    if (error.code === 'P2002') {
      throw new ApiError(409, 'DUPLICATE_RECORD', 'A record with this email already exists');
    }

    throw error;
  }
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    await rejectLogin(password);
  }

  const matches = await comparePassword(password, user.passwordHash);

  if (!matches) {
    throw new ApiError(401, 'UNAUTHORIZED', INVALID_LOGIN);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    select: publicUserSelect,
  });

  const tokens = await issueTokenPair(updated);

  return {
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
    },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

async function refresh({ refreshToken }) {
  const payload = verifyRefreshToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: { select: publicUserSelect } },
  });

  if (
    !stored ||
    stored.revokedAt ||
    stored.expiresAt <= new Date() ||
    stored.userId !== payload.sub ||
    !stored.user.isActive
  ) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const revoked = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (revoked.count !== 1) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  return issueTokenPair(stored.user);
}

async function logout({ refreshToken }) {
  const payload = verifyRefreshToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
  });

  if (!stored || stored.userId !== payload.sub) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  if (!stored.revokedAt) {
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
  }
}

async function me(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });

  if (!user || !user.isActive) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  return toPublicUser(user);
}

module.exports = { register, login, refresh, logout, me };
