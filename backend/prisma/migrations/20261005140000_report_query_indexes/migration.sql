-- Support report filters on resolution and completion times.
CREATE INDEX "alarms_resolved_at_idx" ON "alarms"("resolved_at");
CREATE INDEX "work_orders_completed_at_idx" ON "work_orders"("completed_at");
