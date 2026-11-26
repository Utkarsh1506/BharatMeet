CREATE TYPE "ActionItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE');

CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "sourceMessageId" TEXT,
    "createdByProfileId" TEXT NOT NULL,
    "assigneeProfileId" TEXT,
    "reminderId" TEXT,
    "title" VARCHAR(240) NOT NULL,
    "status" "ActionItemStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActionItem_reminderId_key" ON "ActionItem"("reminderId");
CREATE INDEX "ActionItem_serverId_status_dueAt_idx" ON "ActionItem"("serverId", "status", "dueAt");
CREATE INDEX "ActionItem_channelId_createdAt_idx" ON "ActionItem"("channelId", "createdAt" DESC);
CREATE INDEX "ActionItem_assigneeProfileId_status_dueAt_idx" ON "ActionItem"("assigneeProfileId", "status", "dueAt");
CREATE INDEX "ActionItem_sourceMessageId_idx" ON "ActionItem"("sourceMessageId");

ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_sourceMessageId_fkey"
  FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_createdByProfileId_fkey"
  FOREIGN KEY ("createdByProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_assigneeProfileId_fkey"
  FOREIGN KEY ("assigneeProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_reminderId_fkey"
  FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
