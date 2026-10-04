const authService = require('../services/auth.service');
const { sendSuccess } = require('../utils/apiResponse');

async function register(req, res) {
  const user = await authService.register(req.validated.body);
  sendSuccess(res, 201, 'User registered successfully', { user });
}

async function login(req, res) {
  const session = await authService.login(req.validated.body);
  sendSuccess(res, 200, 'Login successful', session);
}

async function refresh(req, res) {
  const tokens = await authService.refresh(req.validated.body);
  sendSuccess(res, 200, 'Token refreshed successfully', tokens);
}

async function logout(req, res) {
  await authService.logout(req.validated.body);
  sendSuccess(res, 200, 'Logout successful', {});
}

async function me(req, res) {
  const user = await authService.me(req.user.id);
  sendSuccess(res, 200, 'Current user retrieved successfully', { user });
}

module.exports = { register, login, refresh, logout, me };
