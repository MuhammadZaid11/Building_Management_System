const SEVERITY_RANK = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatQuantity(value, unit) {
  const number = Number(value);
  const text = Number.isFinite(number) ? String(number) : String(value);
  return unit ? `${text} ${unit}` : text;
}

function worseSeverity(current, next) {
  return SEVERITY_RANK[next] > SEVERITY_RANK[current] ? next : current;
}

function alarmTypeFor(sensorType, direction) {
  if (sensorType === 'TEMPERATURE') {
    return direction === 'high' ? 'TEMPERATURE_HIGH' : 'TEMPERATURE_LOW';
  }

  if (sensorType === 'HUMIDITY') {
    return direction === 'high' ? 'HUMIDITY_HIGH' : 'HUMIDITY_LOW';
  }

  if (sensorType === 'SMOKE') {
    return 'SMOKE_DETECTED';
  }

  if (sensorType === 'WATER_LEAK') {
    return 'WATER_LEAK';
  }

  if (sensorType === 'ENERGY' && direction === 'high') {
    return 'ENERGY_THRESHOLD';
  }

  return 'SENSOR_OUT_OF_RANGE';
}

function severityFor(sensorType, direction, deviation, span, bound, value) {
  if (sensorType === 'WATER_LEAK') {
    return 'CRITICAL';
  }

  const relative = span !== null && span > 0 ? deviation / span : null;

  if (direction === 'high') {
    if (relative !== null && relative >= 0.5) {
      return 'CRITICAL';
    }

    if (relative === null && bound > 0 && value >= bound * 1.5) {
      return 'CRITICAL';
    }

    return 'HIGH';
  }

  if (relative !== null) {
    if (relative >= 0.5) {
      return 'CRITICAL';
    }

    if (relative >= 0.25) {
      return 'HIGH';
    }

    if (relative >= 0.1) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  if (bound > 0 && value <= bound * 0.5) {
    return 'CRITICAL';
  }

  return 'LOW';
}

function messageFor(sensor, direction, value) {
  const quantity = formatQuantity(value, sensor.unit);

  if (sensor.sensorType === 'TEMPERATURE' && direction === 'high') {
    return `Temperature exceeded maximum threshold: ${quantity}`;
  }

  if (sensor.sensorType === 'TEMPERATURE') {
    return `Temperature dropped below minimum threshold: ${quantity}`;
  }

  if (sensor.sensorType === 'HUMIDITY' && direction === 'high') {
    return `Humidity exceeded maximum threshold: ${quantity}`;
  }

  if (sensor.sensorType === 'HUMIDITY') {
    return `Humidity dropped below minimum threshold: ${quantity}`;
  }

  if (sensor.sensorType === 'SMOKE') {
    return `Smoke level exceeded configured threshold: ${quantity}`;
  }

  if (sensor.sensorType === 'WATER_LEAK') {
    return `Water leak detected: ${quantity}`;
  }

  if (sensor.sensorType === 'ENERGY' && direction === 'high') {
    return `Energy exceeded configured threshold: ${quantity}`;
  }

  if (sensor.sensorType === 'POWER' && direction === 'high') {
    return `Power exceeded configured threshold: ${quantity}`;
  }

  if (sensor.sensorType === 'VOLTAGE') {
    return direction === 'high'
      ? `Voltage exceeded configured threshold: ${quantity}`
      : `Voltage dropped below configured threshold: ${quantity}`;
  }

  if (sensor.sensorType === 'CURRENT' && direction === 'high') {
    return `Current exceeded configured threshold: ${quantity}`;
  }

  if (direction === 'high') {
    return `Sensor reading exceeded maximum threshold: ${quantity}`;
  }

  return `Sensor reading dropped below minimum threshold: ${quantity}`;
}

function evaluateThreshold(sensor, value) {
  const reading = numberOrNull(value);
  const min = numberOrNull(sensor.minValue);
  const max = numberOrNull(sensor.maxValue);

  if (reading === null) {
    return null;
  }

  let direction = null;

  if (max !== null && reading > max) {
    direction = 'high';
  } else if (min !== null && reading < min) {
    direction = 'low';
  }

  if (!direction) {
    return null;
  }

  const bound = direction === 'high' ? max : min;
  const deviation = Math.abs(reading - bound);
  const span = min !== null && max !== null && max > min ? max - min : null;

  return {
    type: alarmTypeFor(sensor.sensorType, direction),
    severity: severityFor(sensor.sensorType, direction, deviation, span, bound, reading),
    message: messageFor(sensor, direction, reading),
  };
}

module.exports = {
  evaluateThreshold,
  worseSeverity,
};
