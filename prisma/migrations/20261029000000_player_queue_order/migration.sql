-- Auctioneer can reorder the upcoming queue; ties fall back to id (the old order).
ALTER TABLE "Player" ADD COLUMN "queueOrder" INTEGER NOT NULL DEFAULT 0;
