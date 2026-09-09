-- Team seats get a 4-digit PIN. Existing rows predate the column, so backfill
-- them with a per-room sequence (1001, 1002, …) before the NOT NULL and the
-- uniqueness constraint go on. Those backfilled PINs are guessable by design —
-- they only exist so old rooms keep working; reseed or rotate them for real use.
ALTER TABLE "Team" ADD COLUMN "passcode" TEXT;

UPDATE "Team" t
SET "passcode" = LPAD((1000 + r.rn)::text, 4, '0')
FROM (
  SELECT id, row_number() OVER (PARTITION BY "roomId" ORDER BY id) AS rn FROM "Team"
) r
WHERE t.id = r.id AND t."passcode" IS NULL;

ALTER TABLE "Team" ALTER COLUMN "passcode" SET NOT NULL;

CREATE UNIQUE INDEX "Team_roomId_passcode_key" ON "Team"("roomId", "passcode");
