-- Short, shareable room codes for URLs (e.g. "ROOM1") instead of the raw
-- cuid — the cuid stays the real primary key everywhere else (foreign keys,
-- socket channel names, cookie auth all keep using it unchanged).
ALTER TABLE "AuctionRoom" ADD COLUMN "code" TEXT;

-- Existing rooms are named "Room 1".."Room 4" — derive their code directly
-- from that. Any future room without a name of that shape falls back to a
-- code derived from its cuid, just so the NOT NULL below never fails.
UPDATE "AuctionRoom"
SET "code" = UPPER(REPLACE("name", ' ', ''))
WHERE "name" ~ '^Room [0-9]+$';

UPDATE "AuctionRoom"
SET "code" = 'ROOM_' || SUBSTRING("id", 1, 8)
WHERE "code" IS NULL;

ALTER TABLE "AuctionRoom" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "AuctionRoom_code_key" ON "AuctionRoom"("code");

-- Team.shortCode (CSK, MI, ...) is already unique per room in practice
-- (the seed assigns exactly one team per IPL code per room) — enforce it,
-- since routes now look teams up by (room, shortCode) instead of by id.
CREATE UNIQUE INDEX "Team_roomId_shortCode_key" ON "Team"("roomId", "shortCode");
