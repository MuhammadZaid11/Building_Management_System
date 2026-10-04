class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function assertFound(record, message) {
  if (!record) {
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', message);
  }

  return record;
}

module.exports = { ApiError, assertFound };
