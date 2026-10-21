-- Upgrade only known previous default palettes; preserve custom colors/borders.
UPDATE "Room"
SET "theme" = '{"surface":"#000000","outgoingBubble":"primary","outgoingText":"#efefef","outgoingBorder":"none","incomingBubble":"#262626","incomingText":"#efefef","incomingBorder":"none","pattern":"none","patternColor":"#ffffff","patternOpacity":"subtle"}'::jsonb
WHERE ('{"outgoingBorder":"#a3a3a3","incomingBorder":"#a3a3a3"}'::jsonb || "theme") IN (
  '{"surface":"#000000","outgoingBubble":"#ffffff","outgoingText":"#09090b","outgoingBorder":"#a3a3a3","incomingBubble":"#000000","incomingText":"#fafafa","incomingBorder":"#a3a3a3","pattern":"none","patternColor":"#ffffff","patternOpacity":"subtle"}'::jsonb,
  '{"surface":"#000000","outgoingBubble":"#ffffff","outgoingText":"#09090b","outgoingBorder":"#a3a3a3","incomingBubble":"#262626","incomingText":"#fafafa","incomingBorder":"#a3a3a3","pattern":"none","patternColor":"#ffffff","patternOpacity":"subtle"}'::jsonb,
  '{"surface":"#000000","outgoingBubble":"#262626","outgoingText":"#efefef","outgoingBorder":"#a3a3a3","incomingBubble":"primary","incomingText":"#efefef","incomingBorder":"#a3a3a3","pattern":"none","patternColor":"#ffffff","patternOpacity":"subtle"}'::jsonb
);

-- Old custom palettes without border preferences should be borderless.
UPDATE "Room"
SET "theme" = '{"outgoingBorder":"none","incomingBorder":"none"}'::jsonb || "theme";

ALTER TABLE "Room" ALTER COLUMN "theme" SET DEFAULT '{"surface":"#000000","outgoingBubble":"primary","outgoingText":"#efefef","outgoingBorder":"none","incomingBubble":"#262626","incomingText":"#efefef","incomingBorder":"none","pattern":"none","patternColor":"#ffffff","patternOpacity":"subtle"}'::jsonb;
