const EVENTS = {
  READING_CREATED: 'reading:created',
  ALARM_CREATED: 'alarm:created',
  ALARM_ACKNOWLEDGED: 'alarm:acknowledged',
  ALARM_RESOLVED: 'alarm:resolved',
  DEVICE_STATUS_CHANGED: 'device:statusChanged',
  MAINTENANCE_CREATED: 'maintenance:created',
  MAINTENANCE_ASSIGNED: 'maintenance:assigned',
  MAINTENANCE_STARTED: 'maintenance:started',
  MAINTENANCE_ON_HOLD: 'maintenance:onHold',
  MAINTENANCE_RESUMED: 'maintenance:resumed',
  MAINTENANCE_COMPLETED: 'maintenance:completed',
  MAINTENANCE_CANCELLED: 'maintenance:cancelled',
};

const CLIENT_EVENTS = {
  JOIN: 'realtime:join',
  LEAVE: 'realtime:leave',
};

module.exports = { EVENTS, CLIENT_EVENTS };
