---
name: write-lore
description: Bulk-write fish3 lore lines (codex, quotes, edicts, legends) or name-pool words for one key, following docs/lore-writing-guide.md. Use with a key like diet.piscivore or signature.crown and an optional count.
---

# write-lore

Arguments: `<key> [count]`, e.g. `diet.piscivore 12`, or `--missing` to take the next keys from the coverage report.

1. Read `docs/lore-writing-guide.md` in full. Its rules win over anything here. If its lexicon (section 3) is still empty, stop and ask the user to fill it or approve one first.
2. Run `node scripts/lore-coverage.mjs --missing` and find the key's row: its kind, how common it is, which pools it feeds and how many lines each has.
3. Look the key up in the guide's key catalogue (section 7). Note exactly which traits produce it, so every line holds for every fish that can carry it.
4. Read the key's existing lines in `src/v3/fish/lore-data.js`, so the new ones do not repeat their openings or images.
5. For each pool the key feeds, write twice the missing count across the rarity tiers (section 4), within the caps and forms of section 5. Use only the tokens it lists. Then cut half by the guide's step 4.
6. Add the survivors under the exact key in `lore-data.js`. Run `npm test` and `node scripts/lore-coverage.mjs`, and fix any stray token or unknown-key report.
7. Show the user 5 rendered entries for fish that carry the key, using `loreText` from `src/v3/fish/lore.js` on seeds that produce it, and list the lines added per pool.
