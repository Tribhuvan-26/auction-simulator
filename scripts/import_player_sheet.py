"""Turn the auction sheet (ipl_player_base_prices and rating.xlsx) into the seed's data.

    python3 -I scripts/import_player_sheet.py "path/to/sheet.xlsx"

Reads the four role tabs (Batters, Wicketkeepers, All-rounders, Bowlers: Name,
Category, Rating / 100, Base Price) plus "Review Needed", and writes:

  prisma/data/auction-pool.json   [{name, role, category, rating}] — who goes in a room
  src/data/player-ratings.json    {name: rating}                   — the rating panel

Base price is not copied: the seed derives it from the rating band, so the two
can't drift. Rows whose sheet price disagrees with the band are listed so the
sheet can be fixed. "Review Needed" rows have no role tab, so they keep the role
from prisma/data/player-roles.json and the capped status from the official list.
"""
import json
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
POOL = ROOT / 'prisma/data/auction-pool.json'
RATINGS = ROOT / 'src/data/player-ratings.json'
ROLES = ROOT / 'prisma/data/player-roles.json'
OFFICIAL = ROOT / 'prisma/data/ipl-2026-official-players.json'

ROLE_TABS = {
    'Batters': 'BATTER',
    'Wicketkeepers': 'WICKET_KEEPER',
    'All-rounders': 'ALL_ROUNDER',
    'Bowlers': 'BOWLER',
}
CATEGORIES = {'Capped', 'Uncapped', 'Overseas'}
BAND_PRICE = {200: '₹2 crore', 100: '₹1 crore', 50: '₹50 lakh'}


def sheet_price_lakhs(cell):
    """The sheet's Base Price as lakhs, whether typed as text ('₹2 crore') or a number (200)."""
    if cell is None or cell == '':
        return None
    if isinstance(cell, (int, float)):
        return int(cell)
    for lakhs, text in BAND_PRICE.items():
        if str(cell).strip() == text:
            return lakhs
    return str(cell).strip()


def band(rating: int) -> int:
    # Same rule as basePriceForRating in prisma/seed.ts.
    return 200 if rating >= 90 else 100 if rating >= 80 else 50


def clean_name(raw: str) -> str:
    name = ' '.join(str(raw).split())
    # A few rows were typed all lower-case ("suresh raina").
    return name.title() if name == name.lower() else name


def main(path: str) -> None:
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    roles = json.loads(ROLES.read_text())
    official = {p['name']: p for p in json.loads(OFFICIAL.read_text())}

    pool: list[dict] = []
    seen: dict[str, str] = {}
    warnings: list[str] = []

    def add(name, role, category, rating, sheet_price, where):
        if name in seen:
            warnings.append(f'{name}: listed twice ({seen[name]} and {where}) — kept the first')
            return
        if category not in CATEGORIES:
            raise SystemExit(f'{name} ({where}): unknown category {category!r}')
        # Whole numbers only: int() would quietly turn 89.6 into 89 and drop a band.
        if not isinstance(rating, (int, float)) or rating != int(rating) or not 0 <= rating <= 100:
            raise SystemExit(f'{name} ({where}): rating must be a whole number 0–100, got {rating!r}')
        rating = int(rating)
        given = sheet_price_lakhs(sheet_price)
        if given is not None and given != band(rating):
            warnings.append(
                f'{name}: sheet says {sheet_price} but rating {rating} is {BAND_PRICE[band(rating)]} — using the band'
            )
        seen[name] = where
        pool.append({'name': name, 'role': role, 'category': category, 'rating': rating})

    for tab, role in ROLE_TABS.items():
        for row in wb[tab].iter_rows(min_row=3, values_only=True):
            if not row or not row[0]:
                continue
            name, category, rating, price = clean_name(row[0]), row[1], row[2], row[3]
            add(name, role, category, rating, price, tab)

    for row in wb['Review Needed'].iter_rows(min_row=3, values_only=True):
        if not row or not row[0]:
            continue
        name, rating, price = clean_name(row[0]), row[2], row[4]
        if name not in roles:
            raise SystemExit(f'{name} (Review Needed): no role in player-roles.json — add one first')
        known = official.get(name)
        category = 'Overseas' if known and known['isOverseas'] else (known or {}).get('capped', 'Uncapped')
        add(name, roles[name], category, rating, price, 'Review Needed')

    POOL.write_text(json.dumps(pool, indent=1, ensure_ascii=False) + '\n')
    ratings = {p['name']: p['rating'] for p in pool}
    RATINGS.write_text(json.dumps(ratings, indent=1, ensure_ascii=False) + '\n')

    no_photo = [p['name'] for p in pool if p['name'] not in official]
    print(f'{len(pool)} players -> {POOL.relative_to(ROOT)}, {RATINGS.relative_to(ROOT)}')
    for role in ROLE_TABS.values():
        print(f'  {role:14} {sum(p["role"] == role for p in pool)}')
    if no_photo:
        print(f'\nNot in the official squad list (no photo): {", ".join(no_photo)}')
    if warnings:
        print('\nCheck the sheet:')
        for w in warnings:
            print(f'  - {w}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
