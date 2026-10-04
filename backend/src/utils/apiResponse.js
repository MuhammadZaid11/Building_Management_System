function serialize(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serialize);
  }

  if (typeof value === 'object') {
    if (typeof value.toFixed === 'function') {
      return value.toString();
    }

    const output = {};

    for (const [key, item] of Object.entries(value)) {
      output[key] = serialize(item);
    }

    return output;
  }

  return value;
}

function sendSuccess(res, statusCode, message, data, pagination) {
  const body = {
    success: true,
    data: serialize(data),
    message,
  };

  if (pagination) {
    body.pagination = pagination;
  }

  res.status(statusCode).json(body);
}

function sendError(res, statusCode, code, message, details) {
  const error = { code, message };

  if (details) {
    error.details = details;
  }

  res.status(statusCode).json({
    success: false,
    error,
  });
}

module.exports = { sendSuccess, sendError, serialize };
