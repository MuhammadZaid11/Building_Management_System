const test = require('node:test');
const assert = require('node:assert/strict');
const {
  toKwh,
  measureConsumption,
  estimateFromPower,
  comparePeriods,
  costFor,
} = require('./energyMath');

function point(kwh, minute) {
  return { kwh, recordedAt: new Date(Date.UTC(2026, 9, 1, 0, minute)) };
}

test('cumulative kWh is the increase, not the sum of register values', () => {
  const result = measureConsumption([point(1000, 0), point(1080, 60)]);
  assert.equal(result.consumptionKwh, 80);
  assert.equal(result.meterResetDetected, false);
  assert.equal(result.source, 'MEASURED');
  assert.equal(costFor(result.consumptionKwh, 0.25), 20);
});

test('an unchanged register consumes nothing', () => {
  const result = measureConsumption([point(1000, 0), point(1000, 60)]);
  assert.equal(result.consumptionKwh, 0);
  assert.equal(result.meterResetDetected, false);
});

test('a meter reset does not produce negative consumption', () => {
  const result = measureConsumption([point(1000, 0), point(20, 60)]);
  assert.equal(result.consumptionKwh, 0);
  assert.equal(result.meterResetDetected, true);
});

test('positive movement around a reset is kept and the drop is not', () => {
  const result = measureConsumption([
    point(1000, 0),
    point(1040, 30),
    point(20, 60),
    point(30, 90),
  ]);
  assert.equal(result.consumptionKwh, 50);
  assert.equal(result.meterResetDetected, true);
});

test('Wh registers are converted before the difference is taken', () => {
  const result = measureConsumption([
    { kwh: toKwh(1000000, 'Wh') },
    { kwh: toKwh(1080000, 'Wh') },
  ]);
  assert.equal(result.consumptionKwh, 80);
});

test('power samples estimate energy with trapezoidal intervals', () => {
  const result = estimateFromPower([
    { kw: 5, recordedAt: new Date('2026-10-01T00:00:00.000Z') },
    { kw: 5, recordedAt: new Date('2026-10-01T02:00:00.000Z') },
  ]);
  assert.equal(result.consumptionKwh, 10);
  assert.equal(result.source, 'ESTIMATED');
});

test('power gaps longer than two hours are not treated as continuous load', () => {
  const result = estimateFromPower([
    { kw: 5, recordedAt: new Date('2026-10-01T00:00:00.000Z') },
    { kw: 5, recordedAt: new Date('2026-10-01T05:00:00.000Z') },
  ]);
  assert.equal(result.consumptionKwh, 0);
});

test('period comparison reports increase, decrease, and no change', () => {
  assert.deepEqual(comparePeriods(1200, 1000), {
    difference: 200,
    changePercent: 20,
    direction: 'INCREASE',
  });
  assert.deepEqual(comparePeriods(800, 1000), {
    difference: -200,
    changePercent: -20,
    direction: 'DECREASE',
  });
  assert.deepEqual(comparePeriods(1000, 1000), {
    difference: 0,
    changePercent: 0,
    direction: 'UNCHANGED',
  });
});

test('a zero previous period does not produce an infinite percentage', () => {
  assert.deepEqual(comparePeriods(0, 0), {
    difference: 0,
    changePercent: 0,
    direction: 'UNCHANGED',
  });
  assert.deepEqual(comparePeriods(10, 0), {
    difference: 10,
    changePercent: null,
    direction: 'INCREASE',
  });
});
