-- Teams that dropped out of a lot. Two teams contest a lot at a time; a third
-- can join only once one of them drops, and a team that dropped stays out.
ALTER TABLE "AuctionLot" ADD COLUMN IF NOT EXISTS "droppedTeamIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
