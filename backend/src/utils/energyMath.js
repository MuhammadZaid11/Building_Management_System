const RESET_TOLERANCE = 0.0001;
const MAX_POWER_GAP_MS = 2 * 60 * 60 * 1000;

function round(value, places) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function toKwh(value, unit) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  if (unit === 'Wh') {
    return number / 1000;
  }

  return number;
}

function toKw(value, unit) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  if (unit === 'W') {
    return number / 1000;
  }

  return number;
}

function measureConsumption(points) {
  let consumptionKwh = 0;
  let meterResetDetected = false;

  for (let index = 1; index < points.length; index += 1) {
    const delta = points[index].kwh - points[index - 1].kwh;

    if (delta < -RESET_TOLERANCE) {
      meterResetDetected = true;
      continue;
    }

    if (delta > 0) {
      consumptionKwh += delta;
    }
  }

  return {
    consumptionKwh: round(consumptionKwh, 4),
    meterResetDetected,
    source: 'MEASURED',
  };
}

function estimateFromPower(points) {
  let consumptionKwh = 0;

  for (let index = 1; index < points.length; index += 1) {
    const elapsed = points[index].recordedAt - points[index - 1].recordedAt;

    if (elapsed <= 0 || elapsed > MAX_POWER_GAP_MS) {
      continue;
    }

    const hours = elapsed / 3600000;
    consumptionKwh += ((points[index - 1].kw + points[index].kw) / 2) * hours;
  }

  return {
    consumptionKwh: round(consumptionKwh, 4),
    meterResetDetected: false,
    source: 'ESTIMATED',
  };
}

function comparePeriods(current, previous) {
  const currentValue = Number(current) || 0;
  const previousValue = Number(previous) || 0;
  const difference = round(currentValue - previousValue, 4);

  if (Math.abs(difference) <= RESET_TOLERANCE) {
    return { difference: 0, changePercent: 0, direction: 'UNCHANGED' };
  }

  if (previousValue === 0) {
    return {
      difference,
      changePercent: null,
      direction: difference > 0 ? 'INCREASE' : 'DECREASE',
    };
  }

  return {
    difference,
    changePercent: round((difference / previousValue) * 100, 2),
    direction: difference > 0 ? 'INCREASE' : 'DECREASE',
  };
}

function costFor(consumptionKwh, rate) {
  if (consumptionKwh === null || !Number.isFinite(consumptionKwh)) {
    return null;
  }

  return round(consumptionKwh * rate, 2);
}

module.exports = {
  MAX_POWER_GAP_MS,
  round,
  toKwh,
  toKw,
  measureConsumption,
  estimateFromPower,
  comparePeriods,
  costFor,
};
