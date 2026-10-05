const { prisma } = require('../db/prisma');
const { ApiError } = require('../utils/apiError');
const { publicUserSelect } = require('../utils/publicUser');
const { verifyAccessToken } = require('../services/token.service');
const { PERMISSIONS } = require('../auth/permissions');

async function authenticateToken(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    if (!payload || typeof payload.sub !== 'string') {
      next(new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: publicUserSelect,
    });

    if (!user || !user.isActive) {
      next(new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function authorizeRoles(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
      return;
    }

    next();
  };
}

function authorize(permission) {
  const roles = PERMISSIONS[permission];

  if (!roles) {
    throw new Error(`Unknown permission: ${permission}`);
  }

  return authorizeRoles(...roles);
}

function limitTechnicianDeviceUpdate(req, res, next) {
  if (!req.user || req.user.role !== 'TECHNICIAN') {
    next();
    return;
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const keys = Object.keys(body);

  if (keys.length !== 1 || !Object.hasOwn(body, 'status')) {
    next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
    return;
  }

  next();
}

module.exports = {
  authenticateToken,
  authorizeRoles,
  authorize,
  limitTechnicianDeviceUpdate,
};
