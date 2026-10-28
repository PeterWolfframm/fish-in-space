# Lore writing guide

How to write every piece of text a fish3 fish says about itself: its names, its codex entry, and
the app copy around it. Read this before you add a line to `src/v3/fish/lore-data.js` or
`src/v3/fish/names-data.js`.

The short version:

1. **Every line is about something the fish really is.** Lines hang on keys (`diet.piscivore`,
   `jaw.fangs`, `signature.crown`) and only appear on fish that carry that key.
2. **Exaggerate the fact, never invent one.** The comedy is total, deadly seriousness about a
   small aquarium fish. A herbivore is never a hunter. A fish that schools is never "alone".
3. **Grimdark liturgy plus card-game flavor text, in style only.** No borrowed names, factions or
   trademarks. Every proper noun comes from this game's own lexicon (section 3).
4. **Run `node scripts/lore-coverage.mjs`** to see what still needs writing.

---

## 1. How the text is built

The text is an output of the procgen, exactly like the pixels. Nothing is random between pools:
the hash only ever picks *within* a pool that a fact about the fish points to.

```
genome ──► phenotype ──► ecology (pure rules, no RNG)     ──► ecology keys  diet.piscivore …
                    └──► salience (most striking traits)   ──► trait keys    jaw.fangs, morph.galaxy …
                    └──► signature (rare)                  ──► rare keys     signature.crown
                                                                rarity key    rarity.myth
```

| Piece | Built by | From |
|---|---|---|
| Common name | `names.js` | lead modifier of the most striking trait + `colour-part` compound + body noun |
| Binomial | `names.js` | body genus + Latin root of the most striking trait + ending |
| Title | `names.js` | signature: `…, the <Title>` |
| Designation | `lore.js` | binomial · class word for the rarity · home depth |
| Quote | `lore.js` | any of the fish's keys that has a quote |
| Codex (3 lines) | `lore.js` | line 1 always diet; lines 2–3 other ecology facts; a trait line may take line 3 |
| Edict | `lore.js` | temperament, sociality or level |
| Legend | `lore.js` | rare only: signature |

Until a key has lines, `lore.js` prints a plain factual sentence for it ("The Golden Fang eats other
fish."). So the entry is always complete and always true, and every line you add is an upgrade.

### What the player sees and can deduce

The ecology chips in the Forge show each fact with a tooltip naming the traits that decided it.
Players learn to read fish: *barbels, so bottom feeder; tubular eyes, so abyss*. Your lines should
**reward** that reading. A line keyed to `level.bottom` can talk about the floor, the silt, the
sunken dark beneath everything. It must not talk about barbels, because a fish can be `level.bottom`
from an underslung snout or a sucker fin instead (see the catalogue, section 7).

---

## 2. The voice

Two registers, blended.

**The codex.** Imperial-archive prose from a grimdark far future, applied to an aquarium:
- catalogue numbers, inquisitorial warnings, martyrs, heresies, sanctioned and forbidden practices;
- scribal marginalia, redactions, the weight of ten thousand years of record-keeping;
- the keeper as a soldier on a lonely front line, the tank as a fortress world.

**The flavor text.** Collectible-card-game flavor text:
- one short italic quote, attributed with a dash to an invented speaker, title or document;
- it hints at a larger world in one sentence and never explains itself.

**Where the "unhinged" comes from.** The text never winks. It never says "lol", never calls the
fish cute or small, and never admits it is talking about a pet. The bigger the gap between the
fact (eats algae) and the gravity of the prose (a doctrine, a war, a prophecy), the funnier it
lands. Keep the fact itself recognisable, so the reader can map the line back to the fish.

**Hard bans**
- No borrowed IP: no real factions, gods, emperors, chapters, planes, planeswalkers, colours of
  mana, card names or catchphrases from any existing game or setting. Write *like* them, never *of* them.
- No real religions, real people, slurs, real-world politics, or gore beyond the comic-grim
  (bones, embers, the void are fine; injuries described in detail are not).
- No lines that only work for one body when the key can be earned by many (section 7 says which
  traits produce each key).
- No facts that contradict another key the same fish could carry. Codex lines sit next to each
  other, so `temperament.peaceful` and `diet.piscivore` must both read fine on one fish.

---

## 3. The lexicon (fill this in first)

Every writer draws proper nouns from **one shared canon**, so a thousand lines read like one
archive. Before bulk-writing, fill these slots once, in this file, and keep them stable. Invent
everything. Check each name against a search engine, and drop any that is a known trademark or
in-world name.

| Slot | What it is | How many | Naming rule |
|---|---|---|---|
| The Archive | the institution that writes the codex | 1 | grand, bureaucratic, Latinate |
| Orders | factions of keepers with doctrines (one per temperament is a good start) | 4–6 | "Order/Conclave/Choir of …" |
| Offices | job titles that sign quotes and edicts | 8–12 | archivist, warden, lector-type titles |
| Named speakers | recurring quote attributions | 10–20 | title + invented name; reuse across lines |
| Heresies | forbidden practices (overfeeding, tapping the glass …) | 6–10 | "-ism" or "the … Heresy" |
| Places | tanks, reefs and trenches as theatres of war | 8–12 | one per depth value at least |
| Units | how the archive measures things (litres, °C, hours) | 4–6 | solemn renamings of real units |
| Calendar | how dates are written in designations and legends | 1 format | e.g. `<cycle>.<number>` |
| Redaction marks | how the archive hides things | 2–3 | e.g. a bracketed expunge mark |

**Latin.** The binomials already use roots from `names-data.js` `LATIN`. Reuse those roots for
order and place names (an order whose name shares a root with `LATIN.jaw` reads as the jaw order).

---

## 4. Register by rarity

The same key can carry different lines per rarity: a line is `{ text, tiers: ['rare', 'myth'] }`.
Lines without `tiers` fit every rarity, so write those in the common register.

| Rarity | Register | Shape | Redaction |
|---|---|---|---|
| common | dry, ominous field note | observed, measured, faintly worried | none |
| uncommon | archive entry | cross-referenced, cites an Order or Office | none |
| rare | codex with warnings | imperative, a sanctioned response, casualties implied | rare, one mark |
| myth | prophecy and apocrypha | fragmentary, contradictory sources, the archive is afraid | sparing; never the key fact |

Myth lines may be broken mid-sentence or attributed to sources that disagree. The fact the line is
keyed to must still be readable through the damage.

---

## 5. Slots, formats and caps

| Slot | Pool | Keys it reads | Cap | Form |
|---|---|---|---|---|
| Quote | `QUOTES` | any key the fish has | ≤ 18 words + attribution | `{ text, by }`, no quote marks, no dash in `by` |
| Codex | `CODEX` | ecology keys (except hardness), trait keys and signature | ≤ 22 words | one or two sentences, third person, present tense |
| Edict | `EDICTS` | `temperament.*`, `sociality.*`, `level.*` | ≤ 14 words | imperative, addressed to the keeper |
| Legend | `LEGENDS` | `signature.*` | ≤ 40 words | past tense, the origin or the price of the feature |
| Class word | `CLASSES` | rarity | 1–3 words | a classification or threat grade, several per tier |

Codex line 1 is always the diet, so `diet.*` keys need the most lines. Lines 2–3 are drawn from
feeding, temperament, activity, depth, level, sociality, current, temp and salinity. A trait key
line replaces line 3 about 60 % of the time when the fish has one.

### Tokens

Use tokens instead of restating facts, so a line stays true when it lands on a different body.

| Token | Gives | Use it for |
|---|---|---|
| `{name}` | common name ("Golden Butter-toothed Fang") | the subject of a codex line |
| `{full}` | name plus title, if any | myth openers |
| `{binomial}` `{genus}` | "Serrasalmus chrysonotus", "Serrasalmus" | archival tone |
| `{body}` `{Body}` | body label, lower and capitalised | when the shape matters |
| `{colour}` | the rolled skin colour, lower case | sparingly, colour is in the name already |
| `{signature}` | its label, lower case (empty if none) | only in keys that guarantee one |
| `{diet}` `{depth}` `{temp}` `{current}` | plain words from `WORDS` ("eats other fish", "the abyss") | only in a key about the same fact |
| `{cm}` `{litres}` `{tempLo}` `{tempHi}` `{group}` | care numbers | edicts; make the numbers solemn, keep them exact |

An unknown token is left in the text verbatim, and the test suite fails on it. Spell them exactly.

---

## 6. Structural examples

These show **shape only**. Placeholders in angle brackets are where your writing goes.

Codex, `diet.herbivore`, common register:

```js
'<field observation of the fish grazing, stated as a measured fact> <one ominous implication for the tank>.'
```

Codex, `temperament.apex`, rare register:

```js
{ text: '<the Archive's threat grade for {name}> <the sanctioned response, in an Office's voice>.', tiers: ['rare', 'myth'] }
```

Quote, `activity.nocturnal`:

```js
{ text: '<a speaker's one-sentence warning about the dark hours>', by: '<Office>, <named speaker>' }
```

Edict, `sociality.school`:

```js
'<imperative about never keeping fewer than {group}>.'
```

Legend, `signature.crown`, rare register:

```js
'<a fragment of the origin of the black sun> <redaction mark> <what it cost the one who witnessed it>.'
```

**Do**
- Make the fact land first, then escalate.
- Reuse lexicon names; recurring speakers build a world.
- Vary sentence openings. Never start more than one line in ten with `{name}`.

**Don't**
- Contradict a co-occurring fact (section 7 lists which facts can sit together).
- Explain the joke, address the reader as a player, or mention pixels, seeds or the app.
- Use the token for a fact in a line keyed to a different fact (`{depth}` inside a `diet.*` line).

---

## 7. Key catalogue

How a fish earns each key, so you know what the player sees. Run `node scripts/lore-coverage.mjs`
for the live list with how common each key is.

### Ecology keys (from `ecology.js`; signatures override last)

| Fact | Values | Decided by |
|---|---|---|
| `diet` | piscivore, carnivore, durophage, omnivore, herbivore, detritivore, planktivore | **jaw** first (fangs, gape, bill: piscivore; piranha: carnivore; beak: durophage; lips, sucker: herbivore; tube: planktivore; grin: omnivore), then a **lure** (piscivore), then **barbels** or an underbite on a bottom body (detritivore), else the body |
| `feeding` | pursuit, ambush, lure, grazing, sifting, picking | lure, then meat eaters with a fast tail or gait pursue and slow ones ambush; herbivores and shell-crushers graze; detritivores sift; the rest pick |
| `level` | top, mid, bottom | snout under, barbels or sucker pelvic fins: bottom; glider pectorals: top; else the body |
| `temperament` | skittish, peaceful, territorial, aggressive, apex | body baseline, +1 armed jaw, +1 spines/venom/horn, +1 huge or giant, −1 tiny, ±1 mood (grumpy up; sleepy, happy down) |
| `sociality` | school, pair, solitary | apex or huge: solitary; tiny or small with stripes or bars: school; territorial and dimorphic: pair; else the body |
| `activity` | diurnal, crepuscular, nocturnal | telescope or tubular eyes, photophores or glow: nocturnal; big eyes: dusk or night; small eyes: day |
| `depth` | shallows, reef, open, twilight, abyss | lure or tubular eyes: abyss; photophores, glow, telescope eyes, ghost/albino/leucistic: twilight; else the body |
| `temp` | cold, temperate, tropical | the body, but a fish pushed deeper than its body's home turns cold |
| `current` | still, gentle, strong, torrent | the body, one step up for a fast tail (lunate, crescent, fork, hetero, sword) or gait (thunniform, carangiform), one step down for a slow tail (veil, lyre, round, streamer, paddle) or gait, long fins and round chonk |
| `salinity` | fresh, brackish, marine | the body |

**Co-occurrence.** Facts are decided by different traits, so assume any two can meet. In a sample
of 4000 fish: a schooling fish is territorial 7 % of the time and aggressive 4 %; a piscivore is
peaceful 2.5 %, even skittish 0.5 %; an aggressive herbivore turns up 1 %. A line about one fact
must survive every value of the others: a `sociality.school` line cannot promise the school is calm.

### Special values (only a signature gives these)

| Key | From | Visual |
|---|---|---|
| `temperament.apex` (forced) | `signature.crown` | gold spikes standing on the head |
| `temperament.peaceful`, `activity.diurnal` | `signature.halo` | a gold ring floating over the head |
| `activity.sleepless` | `signature.thirdeye` | a large slit-pupilled eye in the brow |
| `salinity.any` | `signature.runes` | a glowing script along the lateral line |
| `temp.volcanic` | `signature.embers` | embers shed from the tail, rising and cooling |
| `depth.abyss`, `activity.nocturnal` | `signature.voideye` | the eye is a black hole with one star in it |
| `level.above` | `signature.wings` | a second pair of pale wing fins on the back, beating |
| `sociality.warband` | `signature.brand` | a burning sigil on the flank |
**Rules of the rare feature**: rare fish always have a signature. Common, uncommon and mythic fish
never have one, whatever is locked or bred. Two rare parents that both bear a signature can pass
one on; otherwise it appears only as a breeding sport. Nothing else in the generator can draw it.

### Trait keys (the name's salience order)

The most striking first: signature, `morph.*`, `lure.on`, `glow.on`, `photophores.on`,
`jaw.*`, `extras.*`, `dorsal.*`, `tail.*`, `eyes.*`, `pattern.*`, `size.*` (tiny, huge, giant),
`mood.*`, and always `skin.<colour>` last. The keys listed in `names-data.js` `MODIFIERS` and
`PATTERN_PARTS` are the ones that exist. A trait line describes what the trait *looks like* and
what it says about the fish. It must not restate an ecology fact the trait does not always cause.

### Rarity keys

`rarity.common` … `rarity.myth` exist for quotes only: general archive voice for any fish of that tier.

---

## 8. Name pools (`names-data.js`)

Names are procgen output too. The same traits always give related names.

- **`TAXA[body]`**: `genus` (one pseudo-Latin genus per body; hybrids get their own) and `nouns`
  (3 words). Every noun must be a plausible common name for *that shape* of fish. The noun is
  always the last word of the name, so it must work after any modifier.
- **`MODIFIERS[key]`**: words that describe the trait as seen ("Fanged", "Lantern-bearing").
  They are adjectives a naturalist would use. No free adjectives with no trait behind them, no
  jokes in the modifier slot (the lore carries the voice; the name stays a name).
- **`PARTS` / `PATTERN_PARTS`**: the second half of the `Colour-part` compound ("-finned",
  "-spotted"). Keep them anatomical.
- **`LATIN[key]`**: one root per meaning, stable per trait (glow is always `luci-`/`photo-`).
  Roots must combine with every ending in `LATIN_ENDS` and still be pronounceable.
- **`TITLES[signature]`**: the epithet in "…, the <Title>". Several per feature. A title
  names what the feature *means* in the lore canon (the lexicon), not what it looks like.

`npm test` checks that every common name ends in a noun of its body and every binomial starts with its
genus. The coverage script reports any body without a taxon and any feature without titles.

---

## 9. UI copy

Same canon, much lower dose. **Clarity first**: a button still says what it does in plain words;
the voice goes in tooltips, empty states, headings and event text. Strings live here:

| Where | Strings |
|---|---|
| `app/index.html` | site title and tagline (`.brand`), tab names (Forge, Swipe, My likes, Admin), control labels, panel headings (Traits, Gallery), the dossier's "Codex entry" summary, filters, `#deckEmpty` |
| `app/app.js` | ecology chip labels (`ECO_CHIPS`: diet, feeds, level, temper, kept, active, depth, water, temp, current, tank), play/pause, lock glyph, gallery tooltip |
| `app/swipe.js` | LIKE/NOPE stamps, score bar tooltips, compare hint, `CANNED_NOTES`, notes dialog headings and placeholder, `toast()` messages |
| `app/likes.js` | action button tooltips, empty state |
| `app/auth.js` | backend-offline notice, sign in/out |
| `app/admin.js` | status lines, model card headings, empty states |
| `src/v3/fish/breeding.js` | breeding event sentences (`say(kind, text)`): sterile, blend, pattern, hybrid, vigour, sport, signature, line, reveal |
| `src/v3/fish/genome.js` | trait and choice labels, including `SIGNATURES` (these show in the editor and in `{signature}` tokens, so keep them short and plain) |
| `package.json`, `README.md` | the tagline again |

Breeding events are the best place for the voice outside the codex: one line per event kind,
keeping the plain fact (what changed) readable inside the flourish. Toasts that report errors stay
plain: the user needs the error message.

---

## 10. Bulk-fill procedure

1. Fill the lexicon (section 3) and commit it before writing lines.
2. Pick keys from `node scripts/lore-coverage.mjs --missing`. Start with the most common
   (`diet.*`, `temperament.*`, `depth.*`), then signatures (every rare fish shows one).
3. For each key, read its row in section 7, then write **2× the target** lines (codex 6, quote 2,
   edict 4, legend 4 by default), across tiers.
4. Cut half. Keep the lines whose fact survives the escalation and that do not share an opening
   with any other line in the pool.
5. Add them to `lore-data.js` under the exact key. Run `npm test` (no stray tokens, determinism)
   and the coverage script (unknown keys mean a typo).
6. Read 20 random dossiers end to end in the Forge (re-roll with the lore block open). Look for:
   - contradictions between lines on one fish;
   - repeated openings or words across one entry;
   - lines that only make sense on one body.
7. Repeat for a different rarity tier, so commons don't all sound like myths.

The `/write-lore <key> [count]` skill (`.claude/skills/write-lore/SKILL.md`) runs steps 3–5 for
one key, using this guide.
