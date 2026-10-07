-- Incremental migration for deployments that already have the Bharat Meet baseline schema.
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "presenceStatus" TEXT NOT NULL DEFAULT 'online';

CREATE TABLE IF NOT EXISTS "DirectMessageReaction" (
  "id" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "directMessageId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DirectMessageReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DirectMessageReaction_directMessageId_memberId_emoji_key"
  ON "DirectMessageReaction"("directMessageId", "memberId", "emoji");

CREATE INDEX IF NOT EXISTS "DirectMessageReaction_directMessageId_idx"
  ON "DirectMessageReaction"("directMessageId");

CREATE INDEX IF NOT EXISTS "DirectMessageReaction_memberId_idx"
  ON "DirectMessageReaction"("memberId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DirectMessageReaction_memberId_fkey'
  ) THEN
    ALTER TABLE "DirectMessageReaction"
      ADD CONSTRAINT "DirectMessageReaction_memberId_fkey"
      FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DirectMessageReaction_directMessageId_fkey'
  ) THEN
    ALTER TABLE "DirectMessageReaction"
      ADD CONSTRAINT "DirectMessageReaction_directMessageId_fkey"
      FOREIGN KEY ("directMessageId") REFERENCES "DirectMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
