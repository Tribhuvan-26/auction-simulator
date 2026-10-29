-- Every snapshot and action filters players and lots by room + status.
-- IF NOT EXISTS: some databases already got this index from another branch.
CREATE INDEX IF NOT EXISTS "Player_roomId_status_idx" ON "Player"("roomId", "status");
CREATE INDEX IF NOT EXISTS "AuctionLot_roomId_status_idx" ON "AuctionLot"("roomId", "status");
