const { prisma } = require('../db/prisma');
const { verifyAccessToken } = require('../services/token.service');
const { publicUserSelect } = require('../utils/publicUser');

async function authenticateSocket(socket, next) {
  const token = socket.handshake.auth && socket.handshake.auth.token;

  if (!token || typeof token !== 'string') {
    next(new Error('UNAUTHORIZED'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    if (!payload || typeof payload.sub !== 'string') {
      next(new Error('UNAUTHORIZED'));
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: publicUserSelect,
    });

    if (!user || !user.isActive) {
      next(new Error('UNAUTHORIZED'));
      return;
    }

    socket.user = {
      userId: user.id,
      role: user.role,
    };
    next();
  } catch {
    next(new Error('UNAUTHORIZED'));
  }
}

module.exports = { authenticateSocket };
