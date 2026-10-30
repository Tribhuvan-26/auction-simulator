-- Teams that pressed I'M IN on a lot, in the order they pressed. The first two
-- are the pair contesting it; the auctioneer then enters bids for them.
ALTER TABLE "AuctionLot" ADD COLUMN IF NOT EXISTS "claimedTeamIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
