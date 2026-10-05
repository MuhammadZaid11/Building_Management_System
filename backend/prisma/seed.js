const { PrismaClient } = require('@prisma/client');
const { evaluateThreshold } = require('../src/utils/alarmRules');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEV_USERS = [
  { name: 'Super Admin', email: 'super.admin@bms.local', role: 'SUPER_ADMIN' },
  { name: 'Building Manager', email: 'building.manager@bms.local', role: 'BUILDING_MANAGER' },
  { name: 'Facility Manager', email: 'facility.manager@bms.local', role: 'FACILITY_MANAGER' },
  { name: 'Technician', email: 'technician@bms.local', role: 'TECHNICIAN' },
  { name: 'Viewer', email: 'viewer@bms.local', role: 'VIEWER' },
];

function seedPassword() {
  const configured = (process.env.SEED_DEFAULT_PASSWORD || '').trim();
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (nodeEnv === 'production' && !configured) {
    throw new Error('SEED_DEFAULT_PASSWORD is required when NODE_ENV is production');
  }

  const password = configured || 'ChangeMe-Dev-Only-1';

  if (password.length < 8) {
    throw new Error('SEED_DEFAULT_PASSWORD must be at least 8 characters');
  }

  if (nodeEnv === 'production' && password === 'ChangeMe-Dev-Only-1') {
    throw new Error('Replace SEED_DEFAULT_PASSWORD before seeding a production database');
  }

  return password;
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash(seedPassword(), 10);

  for (const user of DEV_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        passwordHash,
        role: user.role,
        isActive: true,
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
        isActive: true,
      },
    });
  }

  console.log(
    `Seeded ${DEV_USERS.length} development users. These credentials are for local development only. Change SEED_DEFAULT_PASSWORD before production.`
  );
}

async function upsertFloor(tx, buildingId, floor) {
  return tx.floor.upsert({
    where: {
      buildingId_floorNumber: {
        buildingId,
        floorNumber: floor.floorNumber,
      },
    },
    update: {
      name: floor.name,
      description: floor.description,
    },
    create: {
      buildingId,
      name: floor.name,
      floorNumber: floor.floorNumber,
      description: floor.description,
    },
  });
}

async function upsertZone(tx, floorId, zone) {
  return tx.zone.upsert({
    where: {
      floorId_code: {
        floorId,
        code: zone.code,
      },
    },
    update: {
      name: zone.name,
      description: zone.description,
    },
    create: {
      floorId,
      name: zone.name,
      code: zone.code,
      description: zone.description,
    },
  });
}

async function upsertRoom(tx, zoneId, room) {
  return tx.room.upsert({
    where: {
      zoneId_roomNumber: {
        zoneId,
        roomNumber: room.roomNumber,
      },
    },
    update: {
      name: room.name,
      description: room.description,
    },
    create: {
      zoneId,
      name: room.name,
      roomNumber: room.roomNumber,
      description: room.description,
    },
  });
}

async function upsertDevice(tx, roomId, device) {
  const savedDevice = await tx.device.upsert({
    where: { deviceCode: device.deviceCode },
    update: {
      roomId,
      name: device.name,
      deviceType: device.deviceType,
      manufacturer: device.manufacturer,
      model: device.model,
      status: device.status,
      installedAt: device.installedAt,
    },
    create: {
      roomId,
      name: device.name,
      deviceCode: device.deviceCode,
      deviceType: device.deviceType,
      manufacturer: device.manufacturer,
      model: device.model,
      status: device.status,
      installedAt: device.installedAt,
    },
  });

  const sensors = [];

  for (const sensor of device.sensors) {
    sensors.push(await tx.sensor.upsert({
      where: {
        deviceId_name: {
          deviceId: savedDevice.id,
          name: sensor.name,
        },
      },
      update: {
        sensorType: sensor.sensorType,
        unit: sensor.unit,
        minValue: sensor.minValue,
        maxValue: sensor.maxValue,
      },
      create: {
        deviceId: savedDevice.id,
        name: sensor.name,
        sensorType: sensor.sensorType,
        unit: sensor.unit,
        minValue: sensor.minValue,
        maxValue: sensor.maxValue,
      },
    }));
  }

  return { device: savedDevice, sensors };
}

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function demoSeries(start, step, count, intervalHours) {
  return Array.from({ length: count }, (_, index) => ({
    value: (start + step * index).toFixed(2),
    recordedAt: hoursAgo((count - 1 - index) * intervalHours),
  }));
}

async function replaceDemoReadings(tx, sensorId, readings) {
  await tx.deviceReading.deleteMany({ where: { sensorId } });

  if (readings.length === 0) {
    return;
  }

  await tx.deviceReading.createMany({
    data: readings.map((reading) => ({
      sensorId,
      value: reading.value,
      recordedAt: reading.recordedAt,
    })),
  });
}

function demoAlarm({ sensor, device, buildingId, zoneId, value, recordedAt, status, acknowledgedAt, resolvedAt }) {
  const condition = evaluateThreshold(sensor, value);

  return {
    deviceId: device.id,
    buildingId,
    zoneId,
    sensorId: sensor.id,
    type: condition.type,
    severity: condition.severity,
    message: condition.message,
    status,
    triggeredAt: recordedAt,
    acknowledgedAt: acknowledgedAt || null,
    resolvedAt: resolvedAt || null,
  };
}

async function seedMaintenance() {
  const manager = await prisma.user.findUnique({ where: { email: 'facility.manager@bms.local' } });
  const technician = await prisma.user.findUnique({ where: { email: 'technician@bms.local' } });
  const devices = await prisma.device.findMany({
    where: {
      deviceCode: {
        in: [
          'HVAC-OFFICE-101',
          'TEMP-OFFICE-101',
          'HVAC-SERVER-01',
          'HVAC-RECEPTION-01',
          'METER-SERVER-01',
          'METER-ANNEX-01',
        ],
      },
    },
    include: { room: { include: { zone: { include: { floor: true } } } } },
  });
  const byCode = Object.fromEntries(devices.map((device) => [device.deviceCode, device]));
  const buildingIdFor = (code) => byCode[code].room.zone.floor.buildingId;
  const alarm = await prisma.alarm.findFirst({
    where: { deviceId: byCode['HVAC-RECEPTION-01'].id, status: 'RESOLVED' },
    orderBy: { triggeredAt: 'asc' },
  });
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  const openOrder = await prisma.workOrder.create({
    data: {
      workOrderNumber: 'WO-2026-000001',
      title: 'Inspect office HVAC airflow',
      description: 'Check airflow after the office unit was reported offline.',
      deviceId: byCode['HVAC-OFFICE-101'].id,
      buildingId: buildingIdFor('HVAC-OFFICE-101'),
      createdById: manager.id,
      priority: 'MEDIUM',
      status: 'OPEN',
      createdAt: hoursAgo(8),
      estimatedCost: '120.00',
      scheduledAt: new Date(now.getTime() + day),
    },
  });

  await prisma.workOrder.create({
    data: {
      workOrderNumber: 'WO-2026-000002',
      title: 'Calibrate office temperature sensor',
      description: 'Compare the office sensor with a reference thermometer.',
      deviceId: byCode['TEMP-OFFICE-101'].id,
      buildingId: buildingIdFor('TEMP-OFFICE-101'),
      createdById: manager.id,
      assignedToId: technician.id,
      assignedAt: hoursAgo(6),
      createdAt: hoursAgo(10),
      priority: 'HIGH',
      status: 'ASSIGNED',
      estimatedCost: '40.00',
      scheduledAt: new Date(now.getTime() + 2 * day),
    },
  });

  const inProgress = await prisma.workOrder.create({
    data: {
      workOrderNumber: 'WO-2026-000003',
      title: 'Replace server room air filter',
      description: 'The server room filter is due and the rack temperature alarm is active.',
      deviceId: byCode['HVAC-SERVER-01'].id,
      buildingId: buildingIdFor('HVAC-SERVER-01'),
      createdById: manager.id,
      assignedToId: technician.id,
      assignedAt: hoursAgo(20),
      createdAt: hoursAgo(24),
      startedAt: hoursAgo(5),
      priority: 'CRITICAL',
      status: 'IN_PROGRESS',
      estimatedCost: '75.00',
    },
  });

  await prisma.maintenanceActivity.create({
    data: {
      workOrderId: inProgress.id,
      performedById: technician.id,
      description: 'Inspected compressor',
      notes: 'Compressor is running. Filter housing is ready for replacement.',
      cost: '25.00',
      performedAt: hoursAgo(4),
    },
  });

  const onHold = await prisma.workOrder.create({
    data: {
      workOrderNumber: 'WO-2026-000004',
      title: 'Investigate main meter current',
      description: 'Confirm the line current sensor after the last inspection.',
      deviceId: byCode['METER-SERVER-01'].id,
      buildingId: buildingIdFor('METER-SERVER-01'),
      createdById: manager.id,
      assignedToId: technician.id,
      assignedAt: hoursAgo(30),
      createdAt: hoursAgo(36),
      startedAt: hoursAgo(26),
      heldAt: hoursAgo(10),
      priority: 'MEDIUM',
      status: 'ON_HOLD',
      estimatedCost: '50.00',
    },
  });

  await prisma.maintenanceActivity.create({
    data: {
      workOrderId: onHold.id,
      performedById: technician.id,
      description: 'Recorded line current',
      notes: 'Waiting for a replacement clamp meter before closing.',
      cost: '0.00',
      performedAt: hoursAgo(24),
    },
  });

  const completed = await prisma.workOrder.create({
    data: {
      workOrderNumber: 'WO-2026-000005',
      title: 'Inspect HVAC temperature issue',
      description: 'Follow up the resolved supply-air temperature alarm.',
      deviceId: byCode['HVAC-RECEPTION-01'].id,
      alarmId: alarm.id,
      buildingId: buildingIdFor('HVAC-RECEPTION-01'),
      createdById: manager.id,
      assignedToId: technician.id,
      assignedAt: hoursAgo(72),
      createdAt: hoursAgo(80),
      startedAt: hoursAgo(50),
      completedAt: hoursAgo(30),
      priority: 'HIGH',
      status: 'COMPLETED',
      estimatedCost: '150.00',
      actualCost: '30.00',
      completionNotes: 'Supply air returned to range after the filter and coil were cleaned.',
    },
  });

  await prisma.maintenanceActivity.createMany({
    data: [
      {
        workOrderId: completed.id,
        performedById: technician.id,
        description: 'Replaced HVAC air filter',
        notes: 'Filter was loaded. New filter installed.',
        cost: '80.00',
        performedAt: hoursAgo(48),
      },
      {
        workOrderId: completed.id,
        performedById: technician.id,
        description: 'Cleaned condenser coils',
        cost: '25.50',
        performedAt: hoursAgo(36),
      },
    ],
  });

  await prisma.workOrder.create({
    data: {
      workOrderNumber: 'WO-2026-000006',
      title: 'Duplicate annex meter inspection',
      description: 'Cancelled because the annual inspection is already scheduled.',
      deviceId: byCode['METER-ANNEX-01'].id,
      buildingId: buildingIdFor('METER-ANNEX-01'),
      createdById: manager.id,
      priority: 'LOW',
      status: 'CANCELLED',
      createdAt: hoursAgo(20),
      cancelledAt: hoursAgo(12),
      estimatedCost: '20.00',
    },
  });

  await prisma.maintenanceSchedule.createMany({
    data: [
      {
        deviceId: byCode['HVAC-OFFICE-101'].id,
        title: 'HVAC filter inspection',
        description: 'Monthly filter check for the office HVAC unit.',
        frequency: 'MONTHLY',
        nextDueAt: new Date(now.getTime() - day),
        lastCompletedAt: new Date(now.getTime() - 30 * day),
        isActive: true,
        createdById: manager.id,
      },
      {
        deviceId: byCode['HVAC-SERVER-01'].id,
        title: 'Server HVAC inspection',
        description: 'Quarterly inspection of the server room HVAC unit.',
        frequency: 'QUARTERLY',
        nextDueAt: new Date(now.getTime() + 20 * day),
        lastCompletedAt: new Date(now.getTime() - 70 * day),
        isActive: true,
        createdById: manager.id,
      },
      {
        deviceId: byCode['METER-SERVER-01'].id,
        title: 'Energy meter inspection',
        description: 'Annual inspection of the main building energy meter.',
        frequency: 'ANNUALLY',
        nextDueAt: new Date(now.getTime() + 3 * 60 * 60 * 1000),
        isActive: true,
        createdById: manager.id,
      },
      {
        deviceId: byCode['METER-ANNEX-01'].id,
        title: 'Annex meter inspection',
        description: 'Paused until the annex electrical room is commissioned.',
        frequency: 'ANNUALLY',
        nextDueAt: new Date(now.getTime() - 10 * day),
        isActive: false,
        createdById: manager.id,
      },
    ],
  });

  console.log(`Seeded maintenance example ${openOrder.workOrderNumber} and related work orders`);
}

async function main() {
  await prisma.$transaction(async (tx) => {
    const building = await tx.building.upsert({
      where: { code: 'MAIN' },
      update: {
        name: 'Main Office Building',
        address: '100 Market Street',
        description: 'Primary office building used for local development.',
        status: 'ACTIVE',
      },
      create: {
        name: 'Main Office Building',
        code: 'MAIN',
        address: '100 Market Street',
        description: 'Primary office building used for local development.',
        status: 'ACTIVE',
      },
    });

    const groundFloor = await upsertFloor(tx, building.id, {
      name: 'Ground Floor',
      floorNumber: 0,
      description: 'Street level.',
    });

    const firstFloor = await upsertFloor(tx, building.id, {
      name: 'First Floor',
      floorNumber: 1,
      description: 'Staff office level.',
    });

    const receptionZone = await upsertZone(tx, groundFloor.id, {
      name: 'Reception Zone',
      code: 'RECEPTION',
      description: 'Public entrance and waiting area.',
    });

    const serverZone = await upsertZone(tx, groundFloor.id, {
      name: 'Server Zone',
      code: 'SERVER',
      description: 'Secure equipment area.',
    });

    const officeZone = await upsertZone(tx, firstFloor.id, {
      name: 'Office Zone',
      code: 'OFFICE',
      description: 'Staff offices.',
    });

    const receptionRoom = await upsertRoom(tx, receptionZone.id, {
      name: 'Reception Room',
      roomNumber: 'G-01',
      description: 'Front desk and visitor waiting area.',
    });

    const serverRoom = await upsertRoom(tx, serverZone.id, {
      name: 'Server Room',
      roomNumber: 'G-02',
      description: 'Network and server equipment room.',
    });

    const office101 = await upsertRoom(tx, officeZone.id, {
      name: 'Office 101',
      roomNumber: '101',
      description: 'Open staff office.',
    });

    await upsertRoom(tx, officeZone.id, {
      name: 'Office 102',
      roomNumber: '102',
      description: 'Open staff office.',
    });

    const reception = await upsertDevice(tx, receptionRoom.id, {
      name: 'Reception HVAC',
      deviceCode: 'HVAC-RECEPTION-01',
      deviceType: 'HVAC',
      manufacturer: 'Carrier',
      model: '40RU',
      status: 'ONLINE',
      installedAt: new Date('2024-03-15T00:00:00.000Z'),
      sensors: [
        {
          name: 'Supply Air Temperature',
          sensorType: 'TEMPERATURE',
          unit: '°C',
          minValue: '18',
          maxValue: '28',
        },
        {
          name: 'Supply Air Humidity',
          sensorType: 'HUMIDITY',
          unit: '%',
          minValue: '30',
          maxValue: '60',
        },
      ],
    });

    const energyMeter = await upsertDevice(tx, serverRoom.id, {
      name: 'Main Building Energy Meter',
      deviceCode: 'METER-SERVER-01',
      deviceType: 'ENERGY_METER',
      manufacturer: 'Schneider Electric',
      model: 'PM5560',
      status: 'MAINTENANCE',
      installedAt: new Date('2024-03-15T00:00:00.000Z'),
      sensors: [
        {
          name: 'Active Energy',
          sensorType: 'ENERGY',
          unit: 'kWh',
          minValue: '0',
          maxValue: null,
        },
        {
          name: 'Active Power',
          sensorType: 'POWER',
          unit: 'kW',
          minValue: '0',
          maxValue: '20',
        },
        {
          name: 'Line Voltage',
          sensorType: 'VOLTAGE',
          unit: 'V',
          minValue: '200',
          maxValue: '250',
        },
        {
          name: 'Line Current',
          sensorType: 'CURRENT',
          unit: 'A',
          minValue: '0',
          maxValue: '40',
        },
      ],
    });

    const serverHvac = await upsertDevice(tx, serverRoom.id, {
      name: 'Server Room HVAC',
      deviceCode: 'HVAC-SERVER-01',
      deviceType: 'HVAC',
      manufacturer: 'Carrier',
      model: '40RU',
      status: 'ONLINE',
      installedAt: new Date('2024-04-02T00:00:00.000Z'),
      sensors: [
        {
          name: 'Room Smoke',
          sensorType: 'SMOKE',
          unit: 'ppm',
          minValue: '0',
          maxValue: '50',
        },
      ],
    });

    const serverTemperature = await upsertDevice(tx, serverRoom.id, {
      name: 'Server Temperature Sensor',
      deviceCode: 'TEMP-SERVER-01',
      deviceType: 'TEMPERATURE_SENSOR',
      manufacturer: 'Honeywell',
      model: 'T6',
      status: 'ONLINE',
      installedAt: new Date('2024-04-02T00:00:00.000Z'),
      sensors: [
        {
          name: 'Rack Temperature',
          sensorType: 'TEMPERATURE',
          unit: '°C',
          minValue: '16',
          maxValue: '27',
        },
      ],
    });

    await upsertDevice(tx, office101.id, {
      name: 'Office HVAC',
      deviceCode: 'HVAC-OFFICE-101',
      deviceType: 'HVAC',
      manufacturer: 'Daikin',
      model: 'FXMQ',
      status: 'OFFLINE',
      installedAt: new Date('2024-05-10T00:00:00.000Z'),
      sensors: [
        {
          name: 'Office Humidity',
          sensorType: 'HUMIDITY',
          unit: '%',
          minValue: '30',
          maxValue: '60',
        },
      ],
    });

    const officeTemperature = await upsertDevice(tx, office101.id, {
      name: 'Office Temperature Sensor',
      deviceCode: 'TEMP-OFFICE-101',
      deviceType: 'TEMPERATURE_SENSOR',
      manufacturer: 'Honeywell',
      model: 'T6',
      status: 'ONLINE',
      installedAt: new Date('2024-05-10T00:00:00.000Z'),
      sensors: [
        {
          name: 'Office Temperature',
          sensorType: 'TEMPERATURE',
          unit: '°C',
          minValue: '18',
          maxValue: '26',
        },
      ],
    });

    const receptionTemperature = reception.sensors.find((sensor) => sensor.name === 'Supply Air Temperature');
    const receptionHumidity = reception.sensors.find((sensor) => sensor.name === 'Supply Air Humidity');
    const activeEnergy = energyMeter.sensors.find((sensor) => sensor.name === 'Active Energy');
    const activePower = energyMeter.sensors.find((sensor) => sensor.name === 'Active Power');
    const lineVoltage = energyMeter.sensors.find((sensor) => sensor.name === 'Line Voltage');
    const lineCurrent = energyMeter.sensors.find((sensor) => sensor.name === 'Line Current');
    const officeTempSensor = officeTemperature.sensors.find((sensor) => sensor.name === 'Office Temperature');
    const rackTemperature = serverTemperature.sensors.find((sensor) => sensor.name === 'Rack Temperature');
    const roomSmoke = serverHvac.sensors.find((sensor) => sensor.name === 'Room Smoke');
    const temperatureSeries = demoSeries(21.4, 0.2, 12, 10);
    temperatureSeries[4] = { ...temperatureSeries[4], value: '33.50' };
    temperatureSeries[11] = { ...temperatureSeries[11], value: '31' };
    const humiditySeries = demoSeries(42, 0.8, 12, 10);
    humiditySeries[11] = { ...humiditySeries[11], value: '72' };
    const rackReading = { value: '36.5', recordedAt: hoursAgo(1) };
    const smokeReading = { value: '62', recordedAt: hoursAgo(5) };

    await replaceDemoReadings(tx, receptionTemperature.id, temperatureSeries);
    await replaceDemoReadings(tx, receptionHumidity.id, humiditySeries);
    await replaceDemoReadings(tx, activeEnergy.id, demoSeries(1000, 8, 20, 6));
    await replaceDemoReadings(tx, activePower.id, demoSeries(6.2, 0.04, 20, 6));
    await replaceDemoReadings(tx, lineVoltage.id, demoSeries(230, 0.05, 20, 6));
    await replaceDemoReadings(tx, lineCurrent.id, demoSeries(16, 0.08, 20, 6));
    await replaceDemoReadings(tx, officeTempSensor.id, demoSeries(22.1, 0.15, 12, 10));
    await replaceDemoReadings(tx, rackTemperature.id, [rackReading]);
    await replaceDemoReadings(tx, roomSmoke.id, [smokeReading]);

    const annex = await tx.building.upsert({
      where: { code: 'ANNEX' },
      update: {
        name: 'Annex Office',
        address: '18 Harbor Road',
        description: 'Second development building used for energy comparison.',
        status: 'ACTIVE',
      },
      create: {
        name: 'Annex Office',
        code: 'ANNEX',
        address: '18 Harbor Road',
        description: 'Second development building used for energy comparison.',
        status: 'ACTIVE',
      },
    });
    const annexFloor = await upsertFloor(tx, annex.id, {
      name: 'Ground Floor',
      floorNumber: 0,
      description: 'Annex entrance level.',
    });
    const annexZone = await upsertZone(tx, annexFloor.id, {
      name: 'Electrical Zone',
      code: 'ELECTRICAL',
      description: 'Annex electrical room.',
    });
    const annexRoom = await upsertRoom(tx, annexZone.id, {
      name: 'Electrical Room',
      roomNumber: 'A-01',
      description: 'Annex energy meter location.',
    });
    const annexMeter = await upsertDevice(tx, annexRoom.id, {
      name: 'Annex Energy Meter',
      deviceCode: 'METER-ANNEX-01',
      deviceType: 'ENERGY_METER',
      manufacturer: 'Schneider Electric',
      model: 'PM5560',
      status: 'ONLINE',
      installedAt: new Date('2024-06-01T00:00:00.000Z'),
      sensors: [
        {
          name: 'Active Energy',
          sensorType: 'ENERGY',
          unit: 'kWh',
          minValue: '0',
          maxValue: null,
        },
        {
          name: 'Active Power',
          sensorType: 'POWER',
          unit: 'kW',
          minValue: '0',
          maxValue: '15',
        },
      ],
    });
    const annexEnergy = annexMeter.sensors.find((sensor) => sensor.name === 'Active Energy');
    const annexPower = annexMeter.sensors.find((sensor) => sensor.name === 'Active Power');
    await replaceDemoReadings(tx, annexEnergy.id, demoSeries(500, 5, 20, 6));
    await replaceDemoReadings(tx, annexPower.id, demoSeries(3.4, 0.03, 20, 6));

    const seededBuildingIds = [building.id, annex.id];
    await tx.maintenanceActivity.deleteMany({
      where: { workOrder: { buildingId: { in: seededBuildingIds } } },
    });
    await tx.workOrder.deleteMany({
      where: { buildingId: { in: seededBuildingIds } },
    });
    await tx.maintenanceSchedule.deleteMany({
      where: {
        device: { room: { zone: { floor: { buildingId: { in: seededBuildingIds } } } } },
      },
    });
    await tx.alarm.deleteMany({ where: { buildingId: building.id } });
    await tx.alarm.createMany({
      data: [
        demoAlarm({
          sensor: receptionTemperature,
          device: reception.device,
          buildingId: building.id,
          zoneId: receptionZone.id,
          value: temperatureSeries[4].value,
          recordedAt: temperatureSeries[4].recordedAt,
          status: 'RESOLVED',
          resolvedAt: temperatureSeries[5].recordedAt,
        }),
        demoAlarm({
          sensor: receptionTemperature,
          device: reception.device,
          buildingId: building.id,
          zoneId: receptionZone.id,
          value: temperatureSeries[11].value,
          recordedAt: temperatureSeries[11].recordedAt,
          status: 'ACTIVE',
        }),
        demoAlarm({
          sensor: receptionHumidity,
          device: reception.device,
          buildingId: building.id,
          zoneId: receptionZone.id,
          value: humiditySeries[11].value,
          recordedAt: humiditySeries[11].recordedAt,
          status: 'ACTIVE',
        }),
        demoAlarm({
          sensor: rackTemperature,
          device: serverTemperature.device,
          buildingId: building.id,
          zoneId: serverZone.id,
          value: rackReading.value,
          recordedAt: rackReading.recordedAt,
          status: 'ACTIVE',
        }),
        demoAlarm({
          sensor: roomSmoke,
          device: serverHvac.device,
          buildingId: building.id,
          zoneId: serverZone.id,
          value: smokeReading.value,
          recordedAt: smokeReading.recordedAt,
          status: 'ACKNOWLEDGED',
          acknowledgedAt: hoursAgo(4),
        }),
      ],
    });
  });

  await seedUsers();
  await seedMaintenance();

  const counts = await prisma.building.findUnique({
    where: { code: 'MAIN' },
    select: {
      name: true,
      _count: { select: { floors: true } },
    },
  });

  console.log(`Seeded ${counts.name} with ${counts._count.floors} floors`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
