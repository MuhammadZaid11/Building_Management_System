const name = { type: 'string', required: true, minLength: 1, maxLength: 120 };
const email = { type: 'email', required: true };
const password = { type: 'string', required: true, minLength: 8, maxLength: 72 };
const refreshToken = { type: 'string', required: true, minLength: 20, maxLength: 2000 };

const register = {
  body: {
    name,
    email,
    password,
    role: { type: 'enum', values: ['VIEWER'] },
  },
};

const login = {
  body: {
    email,
    password,
  },
};

const refresh = {
  body: {
    refreshToken,
  },
};

const logout = {
  body: {
    refreshToken,
  },
};

module.exports = { register, login, refresh, logout };
