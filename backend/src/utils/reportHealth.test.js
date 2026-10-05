const assert = require('node:assert/strict');
const test = require('node:test');
const {
  healthStatus,
  deviceAvailability,
  alarmCondition,
  maintenanceCondition,
  sensorHealth,
  operationalHealth,
} = require('./reportHealth');

test('health status uses the documented boundaries', () => {
  assert.equal(healthStatus(100), 'EXCELLENT');
  assert.equal(healthStatus(90), 'EXCELLENT');
  assert.equal(healthStatus(89), 'GOOD');
  assert.equal(healthStatus(75), 'GOOD');
  assert.equal(healthStatus(74), 'WARNING');
  assert.equal(healthStatus(60), 'WARNING');
  assert.equal(healthStatus(59), 'CRITICAL');
  assert.equal(healthStatus(0), 'CRITICAL');
  assert.equal(healthStatus(null), null);
});

test('availability is not calculated when a building has no devices', () => {
  assert.equal(deviceAvailability({ total: 0, online: 0 }), null);
  assert.equal(deviceAvailability({ total: 100, online: 82 }), 82);
});

test('alarm, maintenance, and sensor scores stay empty without evidence', () => {
  assert.equal(alarmCondition({ deviceCount: 0, critical: 2 }), null);
  assert.equal(alarmCondition({ deviceCount: 4, critical: 0, high: 0, medium: 0, low: 0 }), 100);
  assert.equal(alarmCondition({ deviceCount: 4, critical: 1, high: 1 }), 65);
  assert.equal(maintenanceCondition({ scheduleCount: 0, workOrderCount: 0, overdue: 3 }), null);
  assert.equal(maintenanceCondition({ scheduleCount: 1, workOrderCount: 0, overdue: 1 }), 80);
  assert.equal(sensorHealth({ evaluated: 0, healthy: 0 }), null);
  assert.equal(sensorHealth({ evaluated: 4, healthy: 3 }), 75);
});

test('overall score uses only components that can be calculated', () => {
  const partial = operationalHealth({
    deviceAvailability: 90,
    alarmCondition: null,
    maintenanceCondition: null,
    sensorHealth: null,
  });
  assert.equal(partial.score, 90);
  assert.equal(partial.status, 'EXCELLENT');

  const empty = operationalHealth({
    deviceAvailability: null,
    alarmCondition: null,
    maintenanceCondition: null,
    sensorHealth: null,
  });
  assert.equal(empty.score, null);
  assert.equal(empty.status, null);

  const mixed = operationalHealth({
    deviceAvailability: 50,
    alarmCondition: 50,
    maintenanceCondition: 50,
    sensorHealth: 50,
  });
  assert.equal(mixed.score, 50);
  assert.equal(mixed.status, 'CRITICAL');
});
