const { prisma } = require('../db/prisma');
const { ApiError, assertFound } = require('../utils/apiError');
const { onlyDefined } = require('../utils/data');
const { findPage } = require('../utils/pagination');
const { hashPassword } = require('../utils/password');
const { publicUserSelect, toPublicUser } = require('../utils/publicUser');

async function list(query) {
  const result = await findPage(prisma.user, {
    orderBy: { createdAt: 'desc' },
    select: publicUserSelect,
    page: query.page,
    limit: query.limit,
  });

  return {
    data: result.data.map(toPublicUser),
    pagination: result.pagination,
  };
}

async function getById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: publicUserSelect,
  });

  return toPublicUser(assertFound(user, 'User not found'));
}

async function create(input) {
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
      },
      select: publicUserSelect,
    });

    return toPublicUser(user);
  } catch (error) {
    if (error.code === 'P2002') {
      throw new ApiError(409, 'DUPLICATE_RECORD', 'A record with this email already exists');
    }

    throw error;
  }
}

async function update(id, input) {
  await getById(id);

  const data = onlyDefined({
    name: input.name,
    email: input.email,
    role: input.role,
  });

  if (input.password) {
    data.passwordHash = await hashPassword(input.password);
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: publicUserSelect,
    });

    return toPublicUser(user);
  } catch (error) {
    if (error.code === 'P2002') {
      throw new ApiError(409, 'DUPLICATE_RECORD', 'A record with this email already exists');
    }

    throw error;
  }
}

async function updateStatus(id, isActive) {
  await getById(id);

  const user = await prisma.user.update({
    where: { id },
    data: { isActive },
    select: publicUserSelect,
  });

  return toPublicUser(user);
}

module.exports = { list, getById, create, update, updateStatus };
