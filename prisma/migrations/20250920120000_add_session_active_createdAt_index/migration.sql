-- Add index to speed active session lookup by (active, createdAt DESC heuristic)
-- Prisma will still issue ORDER BY createdAt DESC with WHERE active = true; composite index helps planner.
CREATE INDEX IF NOT EXISTS "Session_active_createdAt_idx" ON "Session" ("active", "createdAt");
