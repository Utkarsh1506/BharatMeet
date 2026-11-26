CREATE TABLE "TeamPulse" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "pulseDate" DATE NOT NULL,
    "done" TEXT NOT NULL,
    "next" TEXT NOT NULL,
    "blocked" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeamPulse_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ActionItem" ADD COLUMN "sourcePulseId" TEXT;

CREATE UNIQUE INDEX "TeamPulse_serverId_profileId_pulseDate_key"
  ON "TeamPulse"("serverId", "profileId", "pulseDate");
CREATE INDEX "TeamPulse_serverId_pulseDate_idx"
  ON "TeamPulse"("serverId", "pulseDate" DESC);
CREATE INDEX "TeamPulse_channelId_pulseDate_idx"
  ON "TeamPulse"("channelId", "pulseDate" DESC);
CREATE INDEX "ActionItem_sourcePulseId_idx" ON "ActionItem"("sourcePulseId");

ALTER TABLE "TeamPulse" ADD CONSTRAINT "TeamPulse_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamPulse" ADD CONSTRAINT "TeamPulse_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamPulse" ADD CONSTRAINT "TeamPulse_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_sourcePulseId_fkey"
  FOREIGN KEY ("sourcePulseId") REFERENCES "TeamPulse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
