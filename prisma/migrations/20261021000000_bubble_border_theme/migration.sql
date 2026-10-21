-- Upgrade the previous default palettes, preserving custom themes.
UPDATE "Room"
SET "theme" = '{"surface":"#000000","outgoingBubble":"#262626","outgoingText":"#efefef","outgoingBorder":"#a3a3a3","incomingBubble":"primary","incomingText":"#efefef","incomingBorder":"#a3a3a3","pattern":"none","patternColor":"#ffffff","patternOpacity":"subtle"}'::jsonb
WHERE ("theme" - 'incomingBubble' - 'incomingBorder' - 'outgoingBorder') = '{"surface":"#000000","outgoingBubble":"#ffffff","outgoingText":"#09090b","incomingText":"#fafafa","pattern":"none","patternColor":"#ffffff","patternOpacity":"subtle"}'::jsonb
  AND "theme"->>'incomingBubble' IN ('#000000', '#262626')
  AND COALESCE("theme"->>'incomingBorder', '#a3a3a3') = '#a3a3a3'
  AND COALESCE("theme"->>'outgoingBorder', '#a3a3a3') = '#a3a3a3';

-- Supply borders for old custom palettes without changing their chosen colors.
UPDATE "Room"
SET "theme" = '{"outgoingBorder":"#a3a3a3","incomingBorder":"#a3a3a3"}'::jsonb || "theme";

ALTER TABLE "Room" ALTER COLUMN "theme" SET DEFAULT '{"surface":"#000000","outgoingBubble":"#262626","outgoingText":"#efefef","outgoingBorder":"#a3a3a3","incomingBubble":"primary","incomingText":"#efefef","incomingBorder":"#a3a3a3","pattern":"none","patternColor":"#ffffff","patternOpacity":"subtle"}'::jsonb;
