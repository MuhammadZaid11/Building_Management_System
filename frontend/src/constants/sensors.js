export const SENSOR_TYPES = [
  'TEMPERATURE',
  'HUMIDITY',
  'SMOKE',
  'MOTION',
  'WATER_LEAK',
  'ENERGY',
  'POWER',
  'VOLTAGE',
  'CURRENT',
  'PRESSURE',
]

export const SENSOR_UNITS = {
  TEMPERATURE: ['°C', '°F'],
  HUMIDITY: ['%'],
  SMOKE: ['ppm'],
  MOTION: ['count'],
  WATER_LEAK: ['state'],
  ENERGY: ['kWh', 'Wh'],
  POWER: ['kW', 'W'],
  VOLTAGE: ['V'],
  CURRENT: ['A'],
  PRESSURE: ['Pa', 'kPa'],
}

export function unitsForSensorType(sensorType) {
  return SENSOR_UNITS[sensorType] || []
}
