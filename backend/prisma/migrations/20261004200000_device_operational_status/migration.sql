-- Replace equipment status values. Existing ACTIVE rows become ONLINE and
-- INACTIVE rows become OFFLINE. Historical readings and alarms are unchanged.
CREATE TYPE "device_status_new" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE', 'DISABLED');

ALTER TABLE "devices" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "devices"
ALTER COLUMN "status" TYPE "device_status_new"
USING (
  CASE "status"::text
    WHEN 'ACTIVE' THEN 'ONLINE'
    WHEN 'INACTIVE' THEN 'OFFLINE'
    ELSE 'OFFLINE'
  END
)::"device_status_new";

ALTER TYPE "device_status" RENAME TO "device_status_old";
ALTER TYPE "device_status_new" RENAME TO "device_status";
DROP TYPE "device_status_old";

ALTER TABLE "devices" ALTER COLUMN "status" SET DEFAULT 'ONLINE';
