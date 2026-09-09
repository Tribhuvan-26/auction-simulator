-- DropForeignKey
ALTER TABLE "AuctionLot" DROP CONSTRAINT "AuctionLot_roomId_fkey";

-- DropForeignKey
ALTER TABLE "Player" DROP CONSTRAINT "Player_roomId_fkey";

-- DropForeignKey
ALTER TABLE "Team" DROP CONSTRAINT "Team_roomId_fkey";

-- CreateIndex
CREATE INDEX "AuctionLot_roomId_idx" ON "AuctionLot"("roomId");

-- CreateIndex
CREATE INDEX "Bid_lotId_idx" ON "Bid"("lotId");

-- CreateIndex
CREATE INDEX "Bid_teamId_idx" ON "Bid"("teamId");

-- CreateIndex
CREATE INDEX "Player_roomId_idx" ON "Player"("roomId");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE INDEX "Team_roomId_idx" ON "Team"("roomId");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "AuctionRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "AuctionRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionLot" ADD CONSTRAINT "AuctionLot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "AuctionRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
