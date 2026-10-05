const { prisma } = require('../db/prisma');
const { PERMISSIONS } = require('../auth/permissions');

const ROOM_PATTERN = /^(building|device|sensor):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const MAX_ROOMS = 100;

function buildingRoom(id) {
  return `building:${id}`;
}

function deviceRoom(id) {
  return `device:${id}`;
}

function sensorRoom(id) {
  return `sensor:${id}`;
}

function userRoom(id) {
  return `user:${id}`;
}

function canReadOperations(user) {
  return Boolean(user && PERMISSIONS['devices:read'].includes(user.role));
}

async function roomExists(kind, id) {
  if (kind === 'building') {
    const building = await prisma.building.findUnique({ where: { id }, select: { id: true } });
    return Boolean(building);
  }

  if (kind === 'device') {
    const device = await prisma.device.findUnique({ where: { id }, select: { id: true } });
    return Boolean(device);
  }

  const sensor = await prisma.sensor.findUnique({ where: { id }, select: { id: true } });
  return Boolean(sensor);
}

async function authorizeRooms(user, requested) {
  const joined = [];
  const rejected = [];
  const unique = [...new Set(Array.isArray(requested) ? requested : [])].slice(0, MAX_ROOMS);

  if (!canReadOperations(user)) {
    return { joined, rejected: unique };
  }

  for (const room of unique) {
    const match = ROOM_PATTERN.exec(String(room));

    if (!match) {
      rejected.push(String(room));
      continue;
    }

    const kind = match[1].toLowerCase();
    const id = match[2];
    const allowed = await roomExists(kind, id);

    if (!allowed) {
      rejected.push(room);
      continue;
    }

    joined.push(`${kind}:${id}`);
  }

  return { joined, rejected };
}

module.exports = {
  buildingRoom,
  deviceRoom,
  sensorRoom,
  userRoom,
  authorizeRooms,
};
