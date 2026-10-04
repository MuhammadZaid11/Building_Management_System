const { sendError } = require('../utils/apiResponse');

function notFoundHandler(req, res) {
  sendError(
    res,
    404,
    'ROUTE_NOT_FOUND',
    `Route not found: ${req.method} ${req.originalUrl}`
  );
}

module.exports = { notFoundHandler };
