# Collections

Every `.json` file in this folder is a **collection** of training packs. The
randomizer loads all of them automatically and merges them — so to add your own
packs, you just drop a new file in here. No code changes, no registration.

## The format

```jsonc
{
  "name": "My favourite packs",          // shown in the collection filter
  "source": {                            // optional — where the list came from
    "title": "...",
    "url": "https://...",
    "author": "...",
    "fetched": "2026-08-31"
  },
  "packs": [
    {
      "name": "First Touch Boot Camp",       // required
      "code": "F43A-8231-0B8F-B9FA",          // required — the training pack code
      "creator": "Poquito",                    // optional
      "category": "AERIALS",                   // optional — a free-form group
      "difficulty": "Gold",                    // optional — e.g. Silver / Gold / Champion
      "rating": 48,                            // optional — any number (used by --min-rating)
      "tags": ["First touch", "Warmup"],       // optional — free-form tags
      "notes": "Pure first-touch control."     // optional
    }
  ]
}
```

**Only `name` and `code` are required.** Everything else is optional and just
gives you more ways to filter (`--category`, `--difficulty`, `--tag`,
`--min-rating`, `--creator`).

### Codes

A Rocket League training pack code is four groups of four hex characters, e.g.
`2D89-9321-42D2-48BA`. Entries without a valid-looking code are skipped (with a
note), so a typo won't silently roll a broken pack.

### Duplicates

If the same code appears in more than one collection, it's kept once and its
tags are merged. A rolled pack shows every collection it came from.

### Forgiving field names

The loader also accepts a few common aliases so you can often paste a list from
elsewhere with little editing: `note` → `notes`, `author` → `creator`,
`title` → `name`, `description` → `notes`.

## The built-in collections

| File | What it is |
|---|---|
| `reddit-lander1984.json` | Lander1984's rated master list from r/RocketLeagueSchool (ratings out of 50, grouped by skill). |
| `prejump.json` | Prejump's public training-pack database (difficulty, tags, likes) — ~2,300 packs. |

The Prejump collection is a scraper snapshot. Refresh it any time:

```bash
node bin/scrape.mjs        # rewrites collections/prejump.json
```

(or double-click `scrape.cmd` in a release build.)
