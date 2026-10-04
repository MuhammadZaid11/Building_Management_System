const { PrismaClient } = require('@prisma/client');
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

  for (const sensor of device.sensors) {
    await tx.sensor.upsert({
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
    });
  }

  return savedDevice;
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

    await upsertRoom(tx, officeZone.id, {
      name: 'Office 101',
      roomNumber: '101',
      description: 'Open staff office.',
    });

    await upsertRoom(tx, officeZone.id, {
      name: 'Office 102',
      roomNumber: '102',
      description: 'Open staff office.',
    });

    await upsertDevice(tx, receptionRoom.id, {
      name: 'Reception HVAC',
      deviceCode: 'HVAC-RECEPTION-01',
      deviceType: 'HVAC',
      manufacturer: 'Carrier',
      model: '40RU',
      status: 'ACTIVE',
      installedAt: new Date('2024-03-15T00:00:00.000Z'),
      sensors: [
        {
          name: 'Supply Air Temperature',
          sensorType: 'TEMPERATURE',
          unit: 'Celsius',
          minValue: '16',
          maxValue: '30',
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

    await upsertDevice(tx, serverRoom.id, {
      name: 'Server Room Energy Meter',
      deviceCode: 'METER-SERVER-01',
      deviceType: 'ENERGY_METER',
      manufacturer: 'Schneider Electric',
      model: 'PM5560',
      status: 'ACTIVE',
      installedAt: new Date('2024-03-15T00:00:00.000Z'),
      sensors: [
        {
          name: 'Active Energy',
          sensorType: 'ENERGY',
          unit: 'kWh',
          minValue: '0',
          maxValue: null,
        },
      ],
    });
  });

  await seedUsers();

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
