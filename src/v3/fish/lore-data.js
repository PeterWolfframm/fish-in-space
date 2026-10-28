// Lore pools for fish3: the codex entries, quotes, edicts and legends lore.js assembles for each
// fish. Plain data only. Every pool is keyed by a fact about the fish, so a line can only ever
// appear on a fish it is true of. The voice, the rules and the full key catalogue are in
// docs/lore-writing-guide.md -- read it before adding a line. `node scripts/lore-coverage.mjs`
// lists every key and how many lines it has.
//
// Keys:
//   ecology   `diet.piscivore`, `feeding.ambush`, `level.bottom`, `temperament.apex`, `sociality.school`,
//             `activity.nocturnal`, `depth.abyss`, `salinity.marine`, `temp.cold`, `current.torrent`,
//             -- every value in ecology-data.js SCALES and SPECIAL (hardness is care data, not lore)
//   traits    the name salience keys: `jaw.fangs`, `morph.galaxy`, `glow.on`, `tail.veil`, `skin.ember` …
//   rare      `signature.crown` … and `relic.mantle` …
//   rarity    `rarity.common` … `rarity.myth`
//
// A line is a string, or `{ text, tiers }` to keep it to some rarities, e.g.
//   { text: '…', tiers: ['rare', 'myth'] }
// A quote is `{ text, by }` (the attribution, without a dash), optionally with `tiers`.
//
// Tokens, swapped for the fish's own data:
//   {name} common name · {full} name with title · {binomial} · {genus} · {body} {Body} body label
//   {colour} skin colour · {signature} {relic} their labels · {diet} {depth} {temp} {current} plain words
//   {cm} adult length · {litres} tank size · {tempLo} {tempHi} °C · {group} how many to keep
//
// Until a key has lines, lore.js falls back to a plain factual sentence for it.

/** Observations, 2-3 per fish: the body of the entry. */
export const CODEX = {};

/** Flavor quotes with an attribution, one per fish when its keys have any. */
export const QUOTES = {};

/** One keeper's instruction or warning, keyed by temperament, sociality or level. */
export const EDICTS = {};

/** Rare and myth only: the story of the signature or relic. */
export const LEGENDS = {};

/** The catalogue header's class words per rarity tier, e.g. a classification or threat grade. */
export const CLASSES = {
  common: ['Common'],
  uncommon: ['Uncommon'],
  rare: ['Rare'],
  myth: ['Mythic'],
};
