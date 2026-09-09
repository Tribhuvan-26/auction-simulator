-- CreateEnum
CREATE TYPE "PlayerRole" AS ENUM ('BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('UPCOMING', 'LIVE', 'SOLD', 'UNSOLD');

-- CreateEnum
CREATE TYPE "RoomPhase" AS ENUM ('SETUP', 'LIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('QUEUED', 'BIDDING', 'SOLD', 'UNSOLD');

-- CreateTable
CREATE TABLE "AuctionRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phase" "RoomPhase" NOT NULL DEFAULT 'SETUP',
    "round" INTEGER NOT NULL DEFAULT 1,
    "currentLotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "logoUrl" TEXT,
    "colorAccent" TEXT NOT NULL DEFAULT '#2074D5',
    "purseTotal" INTEGER NOT NULL,
    "purseRemaining" INTEGER NOT NULL,
    "squadMax" INTEGER NOT NULL,
    "squadMin" INTEGER NOT NULL,
    "overseasSlotsMax" INTEGER NOT NULL,
    "overseasSlotsUsed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "PlayerRole" NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "photoUrl" TEXT,
    "nationality" TEXT NOT NULL,
    "isOverseas" BOOLEAN NOT NULL DEFAULT false,
    "matches" INTEGER NOT NULL,
    "runs" INTEGER,
    "wickets" INTEGER,
    "average" DOUBLE PRECISION,
    "strikeRate" DOUBLE PRECISION,
    "economy" DOUBLE PRECISION,
    "status" "PlayerStatus" NOT NULL DEFAULT 'UPCOMING',
    "setNumber" TEXT NOT NULL,
    "soldPrice" INTEGER,
    "teamId" TEXT,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionLot" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "currentBid" INTEGER NOT NULL,
    "currentBiddingTeamId" TEXT,
    "status" "LotStatus" NOT NULL DEFAULT 'QUEUED',
    "timerSeconds" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "AuctionLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuctionLot_playerId_key" ON "AuctionLot"("playerId");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "AuctionRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "AuctionRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionLot" ADD CONSTRAINT "AuctionLot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "AuctionRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionLot" ADD CONSTRAINT "AuctionLot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "AuctionLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
