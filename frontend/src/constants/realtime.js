export const REALTIME_EVENTS = {
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
}

export const MAINTENANCE_REALTIME_EVENTS = [
  REALTIME_EVENTS.MAINTENANCE_CREATED,
  REALTIME_EVENTS.MAINTENANCE_ASSIGNED,
  REALTIME_EVENTS.MAINTENANCE_STARTED,
  REALTIME_EVENTS.MAINTENANCE_ON_HOLD,
  REALTIME_EVENTS.MAINTENANCE_RESUMED,
  REALTIME_EVENTS.MAINTENANCE_COMPLETED,
  REALTIME_EVENTS.MAINTENANCE_CANCELLED,
]

export function buildingRoom(id) {
  return `building:${id}`
}

export function deviceRoom(id) {
  return `device:${id}`
}

export function sensorRoom(id) {
  return `sensor:${id}`
}
