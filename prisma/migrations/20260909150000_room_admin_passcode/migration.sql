-- The auctioneer's console needs its own PIN: it raises bids on behalf of every
-- team, so it can't be authorised by a team seat cookie. Existing rooms get an
-- empty string, which hasAdminAccess() treats as "no PIN set" and refuses —
-- reseed or set one before those rooms can be driven again.
ALTER TABLE "AuctionRoom" ADD COLUMN "adminPasscode" TEXT NOT NULL DEFAULT '';
