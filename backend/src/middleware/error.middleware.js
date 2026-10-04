const { Prisma } = require('@prisma/client');
const { ApiError } = require('../utils/apiError');
const { sendError } = require('../utils/apiResponse');

function duplicateMessage(error) {
  const target = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];

  if (target.includes('floorNumber') || target.includes('floor_number')) {
    return 'This floor number is already used in the building';
  }

  if (target.includes('roomNumber') || target.includes('room_number')) {
    return 'This room number is already used in the zone';
  }

  if (target.includes('code') && (target.includes('floorId') || target.includes('floor_id'))) {
    return 'A zone with this code already exists on this floor';
  }

  if (target.includes('code')) {
    return 'A record with this code already exists';
  }

  if (target.length > 0 && target.every((field) => /^[A-Za-z][A-Za-z0-9]*$/.test(field))) {
    return `A record with this ${target.join(', ')} already exists`;
  }

  return 'A record with this value already exists';
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ApiError) {
    sendError(res, err.status, err.code, err.message, err.details);
    return;
  }

  if (err instanceof SyntaxError && err.status === 400 && Object.hasOwn(err, 'body')) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Request body must be valid JSON');
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      sendError(res, 409, 'DUPLICATE_RECORD', duplicateMessage(err));
      return;
    }

    if (err.code === 'P2025') {
      sendError(res, 404, 'RESOURCE_NOT_FOUND', 'Record not found');
      return;
    }

    if (err.code === 'P2003') {
      if (req.method === 'DELETE') {
        sendError(
          res,
          409,
          'CONFLICT',
          'This record cannot be deleted because other records depend on it'
        );
        return;
      }

      sendError(res, 400, 'RELATED_RECORD_NOT_FOUND', 'A related record was not found');
      return;
    }

    if (err.code === 'P2023') {
      sendError(res, 400, 'INVALID_ID', 'Invalid id');
      return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Request data is invalid');
    return;
  }

  console.error(err);
  sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
}

module.exports = { errorHandler };
