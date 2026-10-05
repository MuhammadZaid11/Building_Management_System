const { paginationQuery, idParams, text } = require('./common');

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY'];

function assertNonNegative(value, field, errors) {
  if (value === undefined || value === null) {
    return;
  }

  if (Number(value) < 0) {
    errors.push({ field, message: 'cost must be zero or greater' });
  }
}

const listWorkOrders = {
  query: {
    ...paginationQuery,
    search: text({ maxLength: 100 }),
    status: { type: 'enum', values: STATUSES },
    priority: { type: 'enum', values: PRIORITIES },
    deviceId: { type: 'uuid' },
    buildingId: { type: 'uuid' },
    assignedToId: { type: 'uuid' },
    alarmId: { type: 'uuid' },
    from: { type: 'datetime' },
    to: { type: 'datetime' },
  },
  refine(validated, errors) {
    const { from, to } = validated.query;
    if (from && to && from > to) {
      errors.push({ field: 'query.from', message: 'from must be earlier than or equal to to' });
    }
  },
};

const createWorkOrder = {
  body: {
    title: text({ required: true, minLength: 3, maxLength: 160 }),
    description: text({ maxLength: 4000 }),
    deviceId: { type: 'uuid', required: true },
    alarmId: { type: 'uuid' },
    scheduledAt: { type: 'datetime' },
    assignedToId: { type: 'uuid' },
    priority: { type: 'enum', values: PRIORITIES, required: true },
    estimatedCost: { type: 'decimal' },
  },
  refine(validated, errors) {
    assertNonNegative(validated.body.estimatedCost, 'body.estimatedCost', errors);
  },
};

const updateWorkOrder = {
  params: idParams,
  body: {
    title: text({ minLength: 3, maxLength: 160 }),
    description: text({ maxLength: 4000, nullable: true }),
    priority: { type: 'enum', values: PRIORITIES },
    scheduledAt: { type: 'datetime', nullable: true },
    estimatedCost: { type: 'decimal', nullable: true },
  },
  requireAny: ['title', 'description', 'priority', 'scheduledAt', 'estimatedCost'],
  refine(validated, errors) {
    assertNonNegative(validated.body.estimatedCost, 'body.estimatedCost', errors);
  },
};

const byId = { params: idParams };

const assign = {
  params: idParams,
  body: {
    assignedToId: { type: 'uuid', required: true },
  },
};

const complete = {
  params: idParams,
  body: {
    completionNotes: text({ required: true, minLength: 3, maxLength: 4000 }),
    actualCost: { type: 'decimal' },
    completedAt: { type: 'datetime' },
  },
  refine(validated, errors) {
    assertNonNegative(validated.body.actualCost, 'body.actualCost', errors);
  },
};

const createActivity = {
  params: idParams,
  body: {
    description: text({ required: true, minLength: 3, maxLength: 500 }),
    notes: text({ maxLength: 4000 }),
    cost: { type: 'decimal' },
    performedAt: { type: 'datetime' },
  },
  refine(validated, errors) {
    assertNonNegative(validated.body.cost, 'body.cost', errors);
  },
};

const listSchedules = {
  query: {
    ...paginationQuery,
    deviceId: { type: 'uuid' },
    buildingId: { type: 'uuid' },
    isActive: { type: 'enum', values: ['true', 'false'] },
    due: { type: 'enum', values: ['true', 'false'] },
  },
};

const createSchedule = {
  body: {
    deviceId: { type: 'uuid', required: true },
    title: text({ required: true, minLength: 3, maxLength: 160 }),
    description: text({ maxLength: 4000 }),
    frequency: { type: 'enum', values: FREQUENCIES, required: true },
    nextDueAt: { type: 'datetime', required: true },
    lastCompletedAt: { type: 'datetime' },
    isActive: { type: 'boolean' },
  },
};

const updateSchedule = {
  params: idParams,
  body: {
    deviceId: { type: 'uuid' },
    title: text({ minLength: 3, maxLength: 160 }),
    description: text({ maxLength: 4000, nullable: true }),
    frequency: { type: 'enum', values: FREQUENCIES },
    nextDueAt: { type: 'datetime' },
    lastCompletedAt: { type: 'datetime', nullable: true },
    isActive: { type: 'boolean' },
  },
  requireAny: ['deviceId', 'title', 'description', 'frequency', 'nextDueAt', 'lastCompletedAt', 'isActive'],
};

module.exports = {
  PRIORITIES,
  STATUSES,
  FREQUENCIES,
  listWorkOrders,
  createWorkOrder,
  updateWorkOrder,
  byId,
  assign,
  complete,
  createActivity,
  listSchedules,
  createSchedule,
  updateSchedule,
};
