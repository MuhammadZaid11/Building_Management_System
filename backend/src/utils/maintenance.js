const MANAGER_ROLES = ['SUPER_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER'];

const ASSIGNABLE_ROLES = ['SUPER_ADMIN', 'BUILDING_MANAGER', 'FACILITY_MANAGER', 'TECHNICIAN'];

const TRANSITIONS = {
  assign: { from: ['OPEN', 'ASSIGNED'], to: 'ASSIGNED' },
  start: { from: ['ASSIGNED'], to: 'IN_PROGRESS' },
  hold: { from: ['IN_PROGRESS'], to: 'ON_HOLD' },
  resume: { from: ['ON_HOLD'], to: 'IN_PROGRESS' },
  complete: { from: ['IN_PROGRESS'], to: 'COMPLETED' },
  cancel: { from: ['OPEN', 'ASSIGNED', 'ON_HOLD'], to: 'CANCELLED' },
};

const OPEN_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'];

function transitionTo(action, status) {
  const rule = TRANSITIONS[action];

  if (!rule || !rule.from.includes(status)) {
    return null;
  }

  return rule.to;
}

function money(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return Math.round(amount * 100) / 100;
}

function costSummary(workOrder, activities = []) {
  const activityCost = money(
    activities.reduce((sum, activity) => sum + (money(activity.cost) || 0), 0)
  );
  const additional = workOrder.actualCost === null || workOrder.actualCost === undefined
    ? 0
    : money(workOrder.actualCost);

  return {
    estimatedCost: workOrder.estimatedCost === null || workOrder.estimatedCost === undefined
      ? null
      : money(workOrder.estimatedCost),
    activityCost,
    additionalCost: workOrder.actualCost === null || workOrder.actualCost === undefined ? null : additional,
    totalCost: money(activityCost + (additional || 0)),
  };
}

function startOfUtcDay(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function dueState(schedule, now = new Date()) {
  if (!schedule.isActive) {
    return 'INACTIVE';
  }

  const due = new Date(schedule.nextDueAt).getTime();
  const today = startOfUtcDay(now);
  const tomorrow = today + 24 * 60 * 60 * 1000;

  if (due < today) {
    return 'OVERDUE';
  }

  if (due < tomorrow) {
    return 'DUE';
  }

  return 'UPCOMING';
}

function canManage(user) {
  return Boolean(user && MANAGER_ROLES.includes(user.role));
}

function canExecute(user, workOrder) {
  if (!user || !workOrder) {
    return false;
  }

  if (canManage(user)) {
    return true;
  }

  return user.role === 'TECHNICIAN' && workOrder.assignedToId === user.id;
}

module.exports = {
  MANAGER_ROLES,
  ASSIGNABLE_ROLES,
  TRANSITIONS,
  OPEN_STATUSES,
  transitionTo,
  money,
  costSummary,
  dueState,
  canManage,
  canExecute,
};
