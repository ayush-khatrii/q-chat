-- Only upgrade the previous default; preserve custom room themes.
UPDATE "Room"
SET "theme" = jsonb_set("theme", '{incomingBubble}', '"#262626"'::jsonb)
WHERE "theme" = '{"surface":"#000000","outgoingBubble":"#ffffff","outgoingText":"#09090b","incomingBubble":"#000000","incomingText":"#fafafa","pattern":"none","patternColor":"#ffffff","patternOpacity":"subtle"}'::jsonb;

ALTER TABLE "Room"
  ALTER COLUMN "theme" SET DEFAULT '{"surface":"#000000","outgoingBubble":"#ffffff","outgoingText":"#09090b","incomingBubble":"#262626","incomingText":"#fafafa","pattern":"none","patternColor":"#ffffff","patternOpacity":"subtle"}'::jsonb;
