CREATE TABLE "Appreciation" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "senderProfileId" TEXT NOT NULL,
    "recipientProfileId" TEXT NOT NULL,
    "message" VARCHAR(300) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appreciation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Appreciation_serverId_createdAt_idx"
  ON "Appreciation"("serverId", "createdAt" DESC);
CREATE INDEX "Appreciation_recipientProfileId_createdAt_idx"
  ON "Appreciation"("recipientProfileId", "createdAt" DESC);
CREATE INDEX "Appreciation_senderProfileId_createdAt_idx"
  ON "Appreciation"("senderProfileId", "createdAt" DESC);

ALTER TABLE "Appreciation" ADD CONSTRAINT "Appreciation_serverId_fkey"
  FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appreciation" ADD CONSTRAINT "Appreciation_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appreciation" ADD CONSTRAINT "Appreciation_senderProfileId_fkey"
  FOREIGN KEY ("senderProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appreciation" ADD CONSTRAINT "Appreciation_recipientProfileId_fkey"
  FOREIGN KEY ("recipientProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
