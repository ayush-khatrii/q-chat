UPDATE "Room"
SET "theme" = '{"surface":"#000000","outgoingBubble":"#ffffff","outgoingText":"#09090b","incomingBubble":"#000000","incomingText":"#fafafa","pattern":"none","patternColor":"#ffffff","patternOpacity":"subtle"}'::jsonb;

ALTER TABLE "Room"
  ALTER COLUMN "theme" SET DEFAULT '{"surface":"#000000","outgoingBubble":"#ffffff","outgoingText":"#09090b","incomingBubble":"#000000","incomingText":"#fafafa","pattern":"none","patternColor":"#ffffff","patternOpacity":"subtle"}'::jsonb,
  ALTER COLUMN "theme" SET NOT NULL;
