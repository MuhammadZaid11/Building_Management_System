function createCorsMiddleware(frontendUrl) {
  return function corsMiddleware(req, res, next) {
    const origin = req.get('origin');

    if (frontendUrl && origin === frontendUrl) {
      res.setHeader('Access-Control-Allow-Origin', frontendUrl);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  };
}

module.exports = { createCorsMiddleware };
