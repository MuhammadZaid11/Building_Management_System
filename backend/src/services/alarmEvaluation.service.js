const { evaluateThreshold, worseSeverity } = require('../utils/alarmRules');

const OPEN_STATUSES = ['ACTIVE', 'ACKNOWLEDGED'];

function presentEpisode(alarm) {
  if (!alarm) {
    return null;
  }

  return {
    id: alarm.id,
    type: alarm.type,
    severity: alarm.severity,
    status: alarm.status,
    message: alarm.message,
    triggeredAt: alarm.triggeredAt,
    acknowledgedAt: alarm.acknowledgedAt,
    resolvedAt: alarm.resolvedAt,
  };
}

async function resolveByIds(tx, alarms, resolvedAt) {
  if (alarms.length === 0) {
    return [];
  }

  await tx.alarm.updateMany({
    where: { id: { in: alarms.map((alarm) => alarm.id) } },
    data: { status: 'RESOLVED', resolvedAt },
  });

  return alarms.map((alarm) => ({
    episode: presentEpisode({
      ...alarm,
      status: 'RESOLVED',
      resolvedAt,
    }),
    previousStatus: alarm.status,
  }));
}

async function applyReading(tx, sensor, reading) {
  const newer = await tx.deviceReading.findFirst({
    where: {
      sensorId: sensor.id,
      OR: [
        { recordedAt: { gt: reading.recordedAt } },
        { recordedAt: reading.recordedAt, id: { gt: reading.id } },
      ],
    },
    select: { id: true },
  });

  if (newer) {
    return { alarm: null, effects: [] };
  }

  const condition = evaluateThreshold(sensor, reading.value);
  const open = await tx.alarm.findMany({
    where: { sensorId: sensor.id, status: { in: OPEN_STATUSES } },
    orderBy: [{ triggeredAt: 'desc' }, { id: 'desc' }],
  });

  if (!condition) {
    const resolved = await resolveByIds(tx, open, reading.recordedAt);
    return {
      alarm: resolved[0]?.episode || null,
      effects: resolved.map((item) => ({
        kind: 'resolved',
        alarm: item.episode,
        previousStatus: item.previousStatus,
      })),
    };
  }

  const otherTypes = open.filter((alarm) => alarm.type !== condition.type);
  const resolvedOthers = await resolveByIds(tx, otherTypes, reading.recordedAt);
  const effects = resolvedOthers.map((item) => ({
    kind: 'resolved',
    alarm: item.episode,
    previousStatus: item.previousStatus,
  }));

  const existing = open.find((alarm) => alarm.type === condition.type);

  if (existing) {
    const updated = await tx.alarm.update({
      where: { id: existing.id },
      data: {
        severity: worseSeverity(existing.severity, condition.severity),
        message: condition.message,
      },
    });

    return { alarm: presentEpisode(updated), effects };
  }

  const zone = sensor.device.room.zone;
  const created = await tx.alarm.create({
    data: {
      deviceId: sensor.device.id,
      buildingId: zone.floor.buildingId,
      zoneId: zone.id,
      sensorId: sensor.id,
      type: condition.type,
      severity: condition.severity,
      message: condition.message,
      status: 'ACTIVE',
      triggeredAt: reading.recordedAt,
    },
  });

  const episode = presentEpisode(created);
  return { alarm: episode, effects: [...effects, { kind: 'created', alarm: episode }] };
}

module.exports = { applyReading };
