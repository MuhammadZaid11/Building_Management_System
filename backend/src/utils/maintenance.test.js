const assert = require('node:assert/strict');
const test = require('node:test');
const { transitionTo, costSummary, dueState } = require('./maintenance');

test('work order transitions follow the lifecycle', () => {
  assert.equal(transitionTo('assign', 'OPEN'), 'ASSIGNED');
  assert.equal(transitionTo('start', 'ASSIGNED'), 'IN_PROGRESS');
  assert.equal(transitionTo('hold', 'IN_PROGRESS'), 'ON_HOLD');
  assert.equal(transitionTo('resume', 'ON_HOLD'), 'IN_PROGRESS');
  assert.equal(transitionTo('complete', 'IN_PROGRESS'), 'COMPLETED');
  assert.equal(transitionTo('cancel', 'OPEN'), 'CANCELLED');
  assert.equal(transitionTo('cancel', 'ASSIGNED'), 'CANCELLED');
  assert.equal(transitionTo('cancel', 'ON_HOLD'), 'CANCELLED');
});

test('completed and cancelled work orders do not reopen', () => {
  for (const action of ['assign', 'start', 'hold', 'resume', 'complete', 'cancel']) {
    assert.equal(transitionTo(action, 'COMPLETED'), null);
    assert.equal(transitionTo(action, 'CANCELLED'), null);
  }

  assert.equal(transitionTo('complete', 'OPEN'), null);
  assert.equal(transitionTo('complete', 'ON_HOLD'), null);
  assert.equal(transitionTo('start', 'OPEN'), null);
  assert.equal(transitionTo('cancel', 'IN_PROGRESS'), null);
});

test('total cost adds activity lines and additional completion cost once', () => {
  const summary = costSummary(
    { estimatedCost: '200.00', actualCost: '30.00' },
    [{ cost: '80.00' }, { cost: '25.50' }, { cost: null }]
  );

  assert.equal(summary.estimatedCost, 200);
  assert.equal(summary.activityCost, 105.5);
  assert.equal(summary.additionalCost, 30);
  assert.equal(summary.totalCost, 135.5);
});

test('missing costs stay at zero without becoming NaN', () => {
  const summary = costSummary({ estimatedCost: null, actualCost: null }, []);

  assert.equal(summary.activityCost, 0);
  assert.equal(summary.additionalCost, null);
  assert.equal(summary.totalCost, 0);
});

test('schedule due state uses UTC day boundaries', () => {
  const now = new Date('2026-10-05T12:00:00.000Z');

  assert.equal(dueState({ isActive: false, nextDueAt: '2026-10-01T00:00:00.000Z' }, now), 'INACTIVE');
  assert.equal(dueState({ isActive: true, nextDueAt: '2026-10-04T23:59:00.000Z' }, now), 'OVERDUE');
  assert.equal(dueState({ isActive: true, nextDueAt: '2026-10-05T18:00:00.000Z' }, now), 'DUE');
  assert.equal(dueState({ isActive: true, nextDueAt: '2026-10-06T00:00:00.000Z' }, now), 'UPCOMING');
});
