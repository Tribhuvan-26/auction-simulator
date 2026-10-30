# Admin Console Guide

How to run an auction from the admin screen: `/admin/ROOM1` (use your room's code). Enter the room's 4-digit admin PIN to unlock it.

---

## Running one player, step by step

1. **Bring up a player.** Click **START NEXT LOT** (or **[START LOT]**, or press **N**). The first player in the UP NEXT list comes on screen, and every team screen and the big screen show them.
2. **The two fastest teams get in; you enter every bid.** Each team screen has one **I'M IN** button (or Space). The first two teams to press it are locked in for this player, and everyone else is shut out. Team screens have no BID button: those two call out in the room, and you click their tile to bid the next amount, or use **JUMP BID**. Other teams' tiles are greyed out. To let a third team in, **DROP** one of the two.
3. **Close the player.**
   - Someone bid → press **SOLD** (or **S**). The player goes to the top bidder and the price comes off that team's purse. The sold animation plays on every screen.
   - Nobody bid → press **UNSOLD** (or **U**).
4. **Go to the next player.** Press the green **NEXT PLAYER** button (or **N**).

Repeat until the queue is empty. When the queue runs out and any team still has an empty slot, **NEXT PLAYER** brings the unsold players back for another round.

---

## The screen, part by part

### Top bar

| Item | What it does |
|---|---|
| **SETUP** | Opens the list of keyboard shortcuts. |
| **STANDINGS** | Shows the live leaderboard: score = 80% average rating of players bought + 20% purse left. Teams that can't make a legal XI are listed at the bottom with what they're missing. |
| **PLAYERS LEFT** | How many players are still in the queue. |
| **ALL ROOMS** | Goes to the room list. |
| **LOG OUT** | Locks the admin screen on this browser. |
| **LIVE / PAUSED / COMPLETED** | The room's current state. |

### LOT RESOLUTION (left column)

| Button | Key | What it does |
|---|---|---|
| **SOLD** | S | Sells the player to the team with the highest bid. Refused if that team can't take the player (role full, overseas full, not enough purse). |
| **UNSOLD** | U | Marks the player unsold. Only works when nobody has bid. If someone has bid, use UNDO BID first. |
| **UNDO BID** | Z | Takes back the last step: removes the last bid, or reopens a player you just marked SOLD/UNSOLD. Undoing a sale refunds the team's purse. |
| **NEXT PLAYER** | N | Brings up the next player. Only works after the current player is SOLD or UNSOLD. If the auction was ended, this reopens it. |
| **REPLAY SOLD** | R | Plays the sold animation again on every screen. Only for a sold player. |

### JUMP BID (left column)

Bids a big amount for a team in one go, e.g. when a team shouts a number in the room.

1. Pick the **TEAM**.
2. Type the **AMOUNT** in crore (`2.5` = ₹2.5 Cr).
3. Press **BID**.

The amount must be a valid step on the bid ladder (see Rules below), and the team must be allowed to buy the player. Otherwise you'll see an error saying why.

### Player card (middle)

Shows the player on the block: name, category (capped/uncapped), role, rating, base price, current bid, the leading team and that team's purse.

After SOLD or UNSOLD, a big green **NEXT PLAYER [N]** bar appears under the card.

### ADMIN SIMULATION CONTROLS (right column)

| Button | What it does |
|---|---|
| **[START LOT]** | Same as NEXT PLAYER: brings up the next player. |
| **[PAUSE] / [RESUME]** | Stops all bidding, then lets it continue. Teams can't bid while paused. (Space bar does the same.) |
| **[REOPEN]** | Shows instead of PAUSE after the auction is ended; restarts it. |
| **[DISPUTE]** | Removes the last bid and shows a "dispute flagged" note. Use it when a bid was wrong. |
| **END AUCTION** | Ends the auction after you confirm. All bidding stops and the big screen shows the final standings. To carry on later, press **REOPEN AUCTION** or **NEXT PLAYER**. |

When the auction is ended, a yellow **AUCTION ENDED** banner appears at the top with two buttons:

- **REOPEN AUCTION**: carry on where you stopped.
- **START NEW AUCTION**: start the room over. Every purse goes back to 100 Cr, every squad is emptied, and all players go back in the queue (batters, bowlers, all-rounders, keepers). Teams and PINs stay the same. You confirm first. It clears every sale and can't be undone, so check **STANDINGS** before you press it.

### BIDDING LOG (right column)

Every bid on the current player, newest first, with team, amount and time.

### TEAM BID TRACKER (bottom)

One tile per team, with its purse and squad size (e.g. `3/12`).

- **Click a team's tile** to bid the next amount for that team when it calls out. This is the only way bids get in, besides JUMP BID: team screens can't bid. Once two teams are in (pressed I'M IN or bid), every other tile is greyed out.
- Tile badges: **LEAD** = highest bid now, **IN** = one of the two teams bidding, **OUT** = dropped out of this player.
- The **TEAMS IN · 2/2** panel above the tiles shows the two teams in this player, in their colours, with **LEADING** on the top bidder. The other one has **BID** (raises it to the next amount) and **DROP** (takes it out, which lets a third team press I'M IN). Empty slots say **Slot 1 open** until a team presses I'M IN.

### UP NEXT (bottom right)

The queue of players still to come.

- Under the first player, after a sale, a small green **NEXT PLAYER: <name>** button brings that player up.
- **TO TOP** moves a player to the front of the queue. It does not bring them up; use NEXT PLAYER for that.
- **Player… / Pos / MOVE**: pick a player, type a position (1 = next), and press MOVE to put them anywhere in the queue.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| **S** | Sold |
| **U** | Unsold |
| **Z** | Undo last bid / undo sold or unsold |
| **N** | Next player |
| **R** | Replay sold animation |
| **Space** | Pause / resume |

Shortcuts don't work while you're typing in a box or while a pop-up is open.

---

## Rules the system enforces

**Teams**
- 10 teams, ₹100 Cr purse each.
- Squad of 12: 4 batters, 1 wicket keeper, 2 all-rounders, 4 bowlers, plus one more all-rounder or bowler.
- At most 4 overseas players.
- At least 1 uncapped player.
- A team can't buy a player when that role is full, or when the buy would leave no room for a missing role or the uncapped player.

**Base prices**
- Uncapped: ₹0.5 Cr.
- Capped / overseas: ₹1 Cr, or ₹2 Cr if rated 90 or more.

**Bid steps**

| Current price | Next bid goes up by |
|---|---|
| up to ₹2 Cr | ₹0.1 Cr |
| ₹2 Cr – ₹5 Cr | ₹0.2 Cr |
| ₹5 Cr – ₹10 Cr | ₹0.5 Cr |
| ₹10 Cr and above | ₹1 Cr |

**Bidding**
- The first two teams to press I'M IN (or that you bid for) are locked in. A third team can join only when one of them drops.
- A team that drops can't come back for that player.
- A team with no purse left can't bid.

**Order**
- Batters → bowlers → all-rounders → wicket keepers.
- Unsold players come back at the end while any team still has an empty slot.

**Winner**
- Score = 80% average rating of players bought + 20% purse left (as % of 100 Cr).
- A team that can't field a legal XI (the role counts above plus 1 uncapped) can't win.

---

## Common problems

| Problem | Fix |
|---|---|
| NEXT PLAYER is greyed out | The current player isn't closed. Press SOLD or UNSOLD first. |
| "Auction has ended" | Press **REOPEN AUCTION** in the yellow banner, or NEXT PLAYER. |
| UNSOLD is refused | A team has bid. Press UNDO BID until no bids are left, or SOLD. |
| A team says BID is greyed out | Their screen shows why: two teams already bidding, role full, overseas full, or not enough purse. |
| "Price moved — press BID again" | Another team bid first. The screen has updated; press BID again. |
| Screens a few seconds behind | Live updates aren't connected (check the Supabase key). Screens still update every 3 s. |
| Need to start a room over | Press **END AUCTION**, then **START NEW AUCTION** in the yellow banner. This **clears all sales** in that room. |
