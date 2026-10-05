-- Sensor types become a controlled enum. Existing text values are preserved when they already match.
CREATE TYPE "sensor_type" AS ENUM (
  'TEMPERATURE',
  'HUMIDITY',
  'SMOKE',
  'MOTION',
  'WATER_LEAK',
  'ENERGY',
  'POWER',
  'VOLTAGE',
  'CURRENT',
  'PRESSURE'
);

UPDATE "sensors"
SET "unit" = '°C'
WHERE "unit" IN ('Celsius', 'C', 'celsius');

UPDATE "sensors"
SET "sensor_type" = 'TEMPERATURE'
WHERE "sensor_type" NOT IN (
  'TEMPERATURE',
  'HUMIDITY',
  'SMOKE',
  'MOTION',
  'WATER_LEAK',
  'ENERGY',
  'POWER',
  'VOLTAGE',
  'CURRENT',
  'PRESSURE'
);

ALTER TABLE "sensors"
  ALTER COLUMN "sensor_type" TYPE "sensor_type" USING ("sensor_type"::"sensor_type");

-- deviceId lookups already use the unique (device_id, name) index.
CREATE INDEX "sensors_sensor_type_idx" ON "sensors"("sensor_type");

-- Time-range queries that are not limited to one sensor.
-- (sensor_id, recorded_at) already covers sensorId filters and per-sensor time series.
CREATE INDEX "device_readings_recorded_at_idx" ON "device_readings"("recorded_at");
