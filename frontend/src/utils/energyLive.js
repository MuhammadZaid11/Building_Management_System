function round(value, places) {
  const factor = 10 ** places
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor
}

function toKwh(value, unit) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return unit === 'Wh' ? number / 1000 : number
}

function toKw(value, unit) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return unit === 'W' ? number / 1000 : number
}

function compare(current, previous) {
  const difference = round(current - previous, 4)
  if (Math.abs(difference) <= 0.0001) {
    return { changePercent: 0, direction: 'UNCHANGED', differenceKwh: 0 }
  }
  if (!previous) {
    return {
      changePercent: null,
      direction: difference > 0 ? 'INCREASE' : 'DECREASE',
      differenceKwh: difference,
    }
  }
  return {
    changePercent: round((difference / previous) * 100, 2),
    direction: difference > 0 ? 'INCREASE' : 'DECREASE',
    differenceKwh: difference,
  }
}

export function applyLiveReading(summary, reading) {
  if (!summary || !reading) return summary
  const next = {
    ...summary,
    meters: (summary.meters || []).map((meter) => ({ ...meter })),
    powerSensors: (summary.powerSensors || []).map((sensor) => ({ ...sensor })),
  }

  if (reading.unit === 'kWh' || reading.unit === 'Wh') {
    const meter = next.meters.find((item) => item.sensorId === reading.sensorId)
    const kwh = toKwh(reading.value, reading.unit)
    if (!meter || kwh === null) return summary
    const previous = Number(meter.latestValueKwh)
    meter.latestValue = reading.value
    meter.latestValueKwh = kwh
    meter.recordedAt = reading.recordedAt
    meter.unit = reading.unit
    if (Number.isFinite(previous) && kwh + 0.0001 < previous) {
      meter.meterResetDetected = true
      next.meterResetDetected = true
      return next
    }
    if (Number.isFinite(previous) && kwh >= previous) {
      const delta = kwh - previous
      meter.consumptionKwh = round((Number(meter.consumptionKwh) || 0) + delta, 4)
      next.totalConsumptionKwh = round((Number(next.totalConsumptionKwh) || 0) + delta, 4)
      next.estimatedCost = round(next.totalConsumptionKwh * Number(next.ratePerKwh || 0), 2)
      next.averageDailyKwh = round(next.totalConsumptionKwh / (Number(next.windowDays) || 1), 4)
      Object.assign(next, compare(next.totalConsumptionKwh, Number(next.previousPeriodConsumptionKwh) || 0))
    }
    return next
  }

  if (reading.unit === 'kW' || reading.unit === 'W') {
    const sensor = next.powerSensors.find((item) => item.sensorId === reading.sensorId)
    const kw = toKw(reading.value, reading.unit)
    if (!sensor || kw === null) return summary
    sensor.valueKw = round(kw, 4)
    next.currentPowerKw = round(next.powerSensors.reduce((sum, item) => sum + Number(item.valueKw || 0), 0), 4)
    return next
  }

  return summary
}
