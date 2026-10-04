const bcrypt = require('bcryptjs');

const ROUNDS = 10;

function hashPassword(password) {
  return bcrypt.hash(password, ROUNDS);
}

function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = { hashPassword, comparePassword, ROUNDS };
