-- Alarm type becomes a controlled enum. sensor_id links an episode to the
-- measurement channel that raised it. Historical alarms are not deleted.

CREATE TYPE "alarm_type" AS ENUM (
  'TEMPERATURE_HIGH',
  'TEMPERATURE_LOW',
  'HUMIDITY_HIGH',
  'HUMIDITY_LOW',
  'SMOKE_DETECTED',
  'WATER_LEAK',
  'SENSOR_OUT_OF_RANGE',
  'DEVICE_OFFLINE',
  'ENERGY_THRESHOLD'
);

ALTER TABLE "alarms" ALTER COLUMN "type" TYPE "alarm_type" USING (
  CASE
    WHEN "type" IN (
      'TEMPERATURE_HIGH',
      'TEMPERATURE_LOW',
      'HUMIDITY_HIGH',
      'HUMIDITY_LOW',
      'SMOKE_DETECTED',
      'WATER_LEAK',
      'SENSOR_OUT_OF_RANGE',
      'DEVICE_OFFLINE',
      'ENERGY_THRESHOLD'
    ) THEN "type"::"alarm_type"
    ELSE 'SENSOR_OUT_OF_RANGE'::"alarm_type"
  END
);

ALTER TABLE "alarms" ADD COLUMN "sensor_id" UUID;

CREATE INDEX "alarms_status_triggered_at_idx" ON "alarms"("status", "triggered_at");
CREATE INDEX "alarms_severity_idx" ON "alarms"("severity");
CREATE INDEX "alarms_type_idx" ON "alarms"("type");
CREATE INDEX "alarms_sensor_id_type_status_idx" ON "alarms"("sensor_id", "type", "status");

ALTER TABLE "alarms" ADD CONSTRAINT "alarms_sensor_id_fkey" FOREIGN KEY ("sensor_id") REFERENCES "sensors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
