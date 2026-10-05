const { EVENTS } = require('../socket/events');
const { buildingRoom, deviceRoom, sensorRoom } = require('../socket/rooms');

let io = null;

function attach(server) {
  io = server;
}

function detach() {
  io = null;
}

function targets({ buildingId, deviceId, sensorId }) {
  return [
    buildingId ? buildingRoom(buildingId) : null,
    deviceId ? deviceRoom(deviceId) : null,
    sensorId ? sensorRoom(sensorId) : null,
  ].filter(Boolean);
}

function emit(rooms, event, payload) {
  if (!io) {
    return;
  }

  try {
    const unique = [...new Set(rooms)];
    unique.forEach((room) => io.to(room).emit(event, payload));
  } catch (error) {
    console.error('Realtime emit failed:', error.message);
  }
}

function emitReadingCreated(payload) {
  emit(targets(payload), EVENTS.READING_CREATED, payload);
}

function emitAlarmCreated(payload) {
  emit(targets(payload), EVENTS.ALARM_CREATED, payload);
}

function emitAlarmAcknowledged(payload) {
  emit(targets(payload), EVENTS.ALARM_ACKNOWLEDGED, payload);
}

function emitAlarmResolved(payload) {
  emit(targets(payload), EVENTS.ALARM_RESOLVED, payload);
}

function emitDeviceStatusChanged(payload) {
  emit(targets(payload), EVENTS.DEVICE_STATUS_CHANGED, payload);
}

const MAINTENANCE_EVENTS = {
  created: EVENTS.MAINTENANCE_CREATED,
  assigned: EVENTS.MAINTENANCE_ASSIGNED,
  started: EVENTS.MAINTENANCE_STARTED,
  onHold: EVENTS.MAINTENANCE_ON_HOLD,
  resumed: EVENTS.MAINTENANCE_RESUMED,
  completed: EVENTS.MAINTENANCE_COMPLETED,
  cancelled: EVENTS.MAINTENANCE_CANCELLED,
};

function emitMaintenance(kind, payload) {
  const event = MAINTENANCE_EVENTS[kind];
  if (!event) {
    return;
  }
  emit(targets(payload), event, payload);
}

module.exports = {
  attach,
  detach,
  emitReadingCreated,
  emitAlarmCreated,
  emitAlarmAcknowledged,
  emitAlarmResolved,
  emitDeviceStatusChanged,
  emitMaintenance,
};
