-- Maintenance schedules, work orders, and activity history.
-- Device, alarm, and user deletes stay Restrict so history is not cascaded.

CREATE TYPE "maintenance_frequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY');
CREATE TYPE "work_order_status" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
CREATE TYPE "work_order_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE "maintenance_schedules" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "maintenance_frequency" NOT NULL,
    "next_due_at" TIMESTAMPTZ(3) NOT NULL,
    "last_completed_at" TIMESTAMPTZ(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "work_orders" (
    "id" UUID NOT NULL,
    "work_order_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "device_id" UUID NOT NULL,
    "alarm_id" UUID,
    "building_id" UUID NOT NULL,
    "assigned_to_id" UUID,
    "created_by_id" UUID NOT NULL,
    "priority" "work_order_priority" NOT NULL,
    "status" "work_order_status" NOT NULL DEFAULT 'OPEN',
    "scheduled_at" TIMESTAMPTZ(3),
    "assigned_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "held_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "estimated_cost" DECIMAL(12,2),
    "actual_cost" DECIMAL(12,2),
    "completion_notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "maintenance_activities" (
    "id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "performed_by_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "cost" DECIMAL(12,2),
    "performed_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_activities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_orders_work_order_number_key" ON "work_orders"("work_order_number");
CREATE INDEX "maintenance_schedules_device_id_idx" ON "maintenance_schedules"("device_id");
CREATE INDEX "maintenance_schedules_next_due_at_idx" ON "maintenance_schedules"("next_due_at");
CREATE INDEX "maintenance_schedules_is_active_idx" ON "maintenance_schedules"("is_active");
CREATE INDEX "work_orders_device_id_idx" ON "work_orders"("device_id");
CREATE INDEX "work_orders_alarm_id_idx" ON "work_orders"("alarm_id");
CREATE INDEX "work_orders_building_id_idx" ON "work_orders"("building_id");
CREATE INDEX "work_orders_assigned_to_id_idx" ON "work_orders"("assigned_to_id");
CREATE INDEX "work_orders_status_idx" ON "work_orders"("status");
CREATE INDEX "work_orders_priority_idx" ON "work_orders"("priority");
CREATE INDEX "work_orders_scheduled_at_idx" ON "work_orders"("scheduled_at");
CREATE INDEX "work_orders_created_at_idx" ON "work_orders"("created_at");
CREATE INDEX "maintenance_activities_work_order_id_idx" ON "maintenance_activities"("work_order_id");
CREATE INDEX "maintenance_activities_performed_by_id_idx" ON "maintenance_activities"("performed_by_id");
CREATE INDEX "maintenance_activities_performed_at_idx" ON "maintenance_activities"("performed_at");

ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_alarm_id_fkey" FOREIGN KEY ("alarm_id") REFERENCES "alarms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_activities" ADD CONSTRAINT "maintenance_activities_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_activities" ADD CONSTRAINT "maintenance_activities_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
