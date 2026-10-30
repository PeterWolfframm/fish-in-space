// Algorithm Version History: named checkpoints in each generator family's art and roll history,
// for the Studio's Versions mode. The seed entries below are hand-written, drawn from this repo's
// (and, where noted, aquarium's) real git history. `versions.studio.json` holds anything forked
// from the Studio ("fork as new version") — merged in below, so that file is never clobbered by
// an edit here, and this module is never clobbered by a Studio save.
//
// Each entry: { id, family, generator, algo?, preset?, tuning?, date, commit?, title, summary,
// howItWorks, changes[], customize[] }. `customize` lists the param/tuning paths and hooks that
// matter for that version, each a one-line explanation — the Studio's Versions mode links each one
// to the matching Forge/Anatomy control when the generator exposes it.

import studioVersions from './versions.studio.json' with { type: 'json' };

const SEED_VERSIONS = [
  // pilot ------------------------------------------------------------------------------------
  {
    id: 'pilot-v1', family: 'pilot', generator: 'pilot', date: '2026-10-27', commit: '7577a47',
    title: 'Pilots v1', summary: 'The original 32×32 Burn-Through crew portrait, byte-identical to the game’s own pilot art.',
    howItWorks: 'pilot-pixel.js draws a flat radio portrait from a rolled spec (skin, hair, eyes, paint, suit). A trait system wraps the spec so a crew member can be edited field by field, bred, and shared as a short code; colour fields cover every colour either a rolled crew member or a hand-made avatar can produce, so both round-trip.',
    changes: ['First pilot generator, ported 1:1 from the game’s crew-room code.'],
    customize: [],
  },
  {
    id: 'pilot-v2', family: 'pilot', generator: 'pilot2', date: '2026-10-27', commit: 'e22d4a5',
    title: 'Pilots v2', summary: 'Lit crew art in four framings (icon, portrait, bust, cockpit) at one pixel density, with idle/expression animation.',
    howItWorks: 'A callsign rolls the same person v1 would (same fields, same rolls) via fromV1Code, so a v1 code reopens as the same pilot; appended fields (helmet style, scar, freckles, framing) roll from that seed too. Drawing goes through a shared pose rig (anim/rig.js) so expressions and talk/blink motions are lists of motions, not separate sprite sheets.',
    changes: ['Added lighting, four framings, and pose-rig animation (expression, talk, shake, glance, blink).', 'v1 codes still decode, as remasters.'],
    customize: [],
  },

  // fish ---------------------------------------------------------------------------------------
  {
    id: 'fish-v1', family: 'fish', generator: 'fish', date: '2026-10-27', commit: '7577a47',
    title: 'Fish v1', summary: 'The original 48×32 fish., byte-identical to the game’s own fish art.',
    howItWorks: 'genome.js rolls a flat trait set from a seed; draw.js paints it directly at one fixed size. No size classes, no growth stages — one fish is one drawing.',
    changes: ['First fish generator, ported 1:1 from the game’s own code.'],
    customize: [],
  },
  {
    id: 'fish-v2', family: 'fish', generator: 'fish2', date: '2026-10-27', commit: 'e22d4a5',
    title: 'Fish v2', summary: 'Lit, rounded fish at constant pixel density across six size classes, with a pose-rig swim.',
    howItWorks: 'fromV1Code lets a v1 code reopen as the same fish (remastered). CLASS_LEN gives each of six size classes its own canvas at the same pixel density, so a tiny fish is drawn small rather than scaled down from a big canvas. Swim/hover/dart/turn motions compose through the shared v2 pose rig.',
    changes: ['Added six size classes at constant pixel density (replacing v1’s one fixed canvas).', 'Added lighting and a pose-rig swim cycle.'],
    customize: [],
  },
  {
    id: 'fish-v3', family: 'fish', generator: 'fish3', date: '2026-10-28', commit: '6ee7478',
    title: 'Fish v3', summary: 'v1’s cute fish grown up: 32 bodies, Mendelian colour genes, breeding, names/ecology/lore read off the body.',
    howItWorks: 'phenotype.js turns a genome into physical numbers (length, fin shape, markings) through formulas keyed on size class and life stage (fry/juvenile/adult/elder), each with its own stageLen multiplier. draw.js paints the body first, which stamps a per-pixel tone map (ctx.toneAt/ctx.repaint) that every texture-like part (scales, markings, wear, morphOverlay…) paints through — those parts are modulations of the body, not independent sprites. Breeding is Mendelian: two colour loci, with lines and sports possible.',
    changes: ['Replaced v2’s one-roll-per-fish-part look with 32 distinct bodies plus hybrids.', 'Added Mendelian colour genes, a physically modelled swim in three camera looks, and names/ecology/lore derived from the body.', 'Still reads v1 fish codes.'],
    customize: [],
  },
  {
    id: 'fish-v4-classic', family: 'fish', generator: 'fish4', algo: 'classic', preset: 'classic', date: '2026-10-29', commit: 'a7e281b',
    title: 'Fish v4 — classic roll', summary: 'fish3’s exact look, with fish4’s quantitative genome, stats, taxonomy and rarity layered on top. `classic` rolls every field independently, exactly as fish3 did.',
    howItWorks: 'fish4 keeps fish3’s painter pixel for pixel (same PARTS, same bodies) but replaces the trait roll with a diploid genome (loci.js) carrying continuous values, evidence-backed stats (stats.js), a shallow taxonomy, six-tier rarity, reproduction and value genes, feature modules (e.g. the space helmet), and expressions. Under `classic`, each field still rolls on its own — no place-first clustering.',
    changes: ['New quantitative genome, stats-with-evidence, taxonomy, rarity, reproduction/value genes, feature modules and expressions — all on fish3’s unchanged art.', 'f4., f3. and v1 codes all decode.'],
    customize: [{ path: 'algo', note: '‘classic’: every field rolls on its own, fish3-style. Switch to see the ecotype roll instead.' }],
  },
  {
    id: 'fish-v4-ecotype-1', family: 'fish', generator: 'fish4', algo: 'ecotype-1', preset: 'ecotype', date: '2026-10-29', commit: 'abe40a7',
    title: 'Fish v4 — ecotype-1 roll', summary: 'A seed picks a place and a species before it picks a look, so fish cluster into recognisable kinds instead of rolling every field independently.',
    howItWorks: 'terrain → region → niche → clade (species) → individual. Each (region, niche, clade) has a prototype rolled once from its own seed under the region/niche’s leanings; an individual keeps each prototype field with chance cohesion×stickiness[group] and otherwise rolls its own under the same leanings. Mutation pressure then applies (region-scaled chaos odds, occasional sports), and loci roll last around bell centres the niche shifted. Deterministic: only the seed and params decide.',
    changes: ['New default roll: places and species clustering, replacing field-by-field independence.', 'Became the DEFAULT_PRESET (‘ecotype’, aliasing the newest ecotype-N).', 'A change that moves which fish a seed gives must land as a new algo id (ecotype-2…), so stored codes never silently remap.'],
    customize: [
      { path: 'algo', note: '‘ecotype-1’ (or plain ‘ecotype’ for the newest): the place-first roll. ‘classic’ reverts to fish3-style independent fields.' },
      { path: 'terrains', note: 'Per-terrain odds (water, lava, sand, nuclear, aether); missing = that terrain’s default.' },
      { path: 'unlocked', note: 'Locked terrains to open, e.g. [‘aether’].' },
      { path: 'clusters.cohesion', note: '0..1: how much an individual looks like its species prototype.' },
      { path: 'clusters.speciesPerNiche', note: '1..8 clades per niche, Zipf-weighted by clusters.zipf.' },
      { path: 'mutation.strength', note: 'Exponent on each region’s mutation pressure.' },
      { path: 'mutation.sport', note: 'Base chance of a sport (a region-specific morph) per individual.' },
    ],
  },
  {
    id: 'fish-v4-aquarium-fit', family: 'fish', generator: 'fish4', date: '2026-10-30', commit: '4a35270',
    title: 'Fish v4 — aquarium paint budget + young-fish sizing', summary: 'A standing, aquarium-only fork of phenotype.js: adults paint at a uniform full-detail budget (no pixelated tiny-class adults), while fry/juveniles paint small again.',
    howItWorks: 'scripts/forge-paint-len.patch (re-applied on every `vendor-forge.mjs` run) adds PAINT_LEN=38: adult/elder always paint at that budget regardless of size class, with size shown instead via whole-number on-screen zoom (src/game/fish.ts’s zoomForStageSize/CLASS_VIEW) so no pixels are lost. Fry/juveniles restore the pre-regression stageLen formula ({fry:.45, juvenile:.7}), capped at PAINT_LEN so a young fish can never be bigger than its own adult art. This conflicts with pixelforge’s own “bigger class, bigger canvas” design and the v4e eye-cap feature, so it deliberately stays a standing patch rather than going upstream into this repo’s own phenotype.js.',
    changes: ['Fixed a regression (pixelated tiny-class adults) without re-breaking fry/juvenile sizing.', 'Adults: full-detail paint at every size class; shown smaller via integer zoom only in the big UI views.', 'Fry/juveniles: painted small again, capped at the adult paint length.'],
    customize: [
      { path: 'PAINT_LEN', note: 'forge/v3/fish/phenotype.js — the adult/elder paint budget in pixels (38). Aquarium-only; lives in the standing patch, not pixelforge src.' },
      { path: 'stageLen.fry / stageLen.juvenile', note: 'forge/v3/fish/phenotype.js — young-fish paint-size multipliers (.45 / .7) against the size class’s own length, capped at PAINT_LEN.' },
      { path: 'CLASS_VIEW', note: 'src/game/fish.ts — per-size-class zoom multiplier for the big UI views (tiny .5 … huge/giant 1). Tunable right in the Studio’s Growth panel.' },
    ],
  },

  // waterplant -------------------------------------------------------------------------------
  {
    id: 'waterplant-v1', family: 'waterplant', generator: 'waterplant', date: '2026-10-27', commit: '7577a47',
    title: 'Tank plants v1', summary: 'Kelp, eelgrass, ferns, swords, moss balls and sea fans that sway in a seamless loop — fish.’s seaweed, lost when the old vector background went.',
    howItWorks: 'A genome’s code fully describes the sprite: layout detail (blade count, lean) rolls from the code itself via stroke-walk helpers (walk/pointOn/blade), not the seed, so a shared code is the exact plant and a mutation can change it. `variant` exists only to give those code-rolls 36 different starting points.',
    changes: ['First tank-plant generator.'],
    customize: [],
  },
  {
    id: 'waterplant-v2', family: 'waterplant', generator: 'waterplant2', date: '2026-10-27', commit: 'e22d4a5',
    title: 'Tank plants v2', summary: 'Lit, layered tank plants in four size classes at constant pixel density, three new forms, a shaded bed.',
    howItWorks: 'fromV1Code remasters a v1 code into the same plant. Four size classes (CLASS_H) each get their own canvas at constant pixel density. Animation composes sway/gust/flutter/bubbles/pulse motions through the shared v2 pose rig.',
    changes: ['Added four size classes at constant pixel density, lighting, a shaded bed, and three new plant forms.', 'v1 codes still decode, as remasters.'],
    customize: [],
  },

  // plant --------------------------------------------------------------------------------------
  {
    id: 'plant-v1', family: 'plant', generator: 'plant', date: '2026-10-27', commit: '7577a47',
    title: 'Garden plants v1 (16px)', summary: 'Grain, rosettes, flowers, bushes, saplings, vines, cacti, bamboo and mushrooms for plantasia, drawn at any point of their growth.',
    howItWorks: 'A plant is built once as a skeleton of parts (stems, leaves, flowers, fruit), each with a birth (0..1) and a span. Drawing at growth t shows each born part cut short at its own progress, so a sprout is literally the bottom of the full-grown plant — plantasia’s four stages are one plant, not four separate drawings. Native size 16×16, the viewBox PlantSprite draws in.',
    changes: ['First garden-plant generator.'],
    customize: [],
  },
  {
    id: 'plant-v1-32', family: 'plant', generator: 'plant32', date: '2026-10-27', commit: '7577a47',
    title: 'Garden plants v1 (32px)', summary: 'The same v1 plant generator, painted with room for more detail (32×32 instead of 16×16).',
    howItWorks: 'Identical skeleton/growth model to plant v1 — only the canvas size and the detail the strokes resolve to change.',
    changes: ['Added a 32px canvas variant alongside the original 16px one.'],
    customize: [],
  },
  {
    id: 'plant-v2', family: 'plant', generator: 'plant2', date: '2026-10-27', commit: 'e22d4a5',
    title: 'Garden plants v2', summary: 'Growing plants in five size classes at constant pixel density, from a herb to a giant tree, lit and branching, swaying in the wind.',
    howItWorks: 'Same growth model as v1 (stages/grow/at(t) still show one plant growing, never four drawings), now with five size classes (CLASS_H) each at constant pixel density, plus lighting and wind sway through the v2 pose rig.',
    changes: ['Added five size classes at constant pixel density (herb → giant tree).', 'Added lighting, branching detail, and wind-sway animation.'],
    customize: [],
  },
  {
    id: 'plant-v3', family: 'plant', generator: 'plant3', date: '2026-10-28', commit: '6ee7478',
    title: 'Garden plants v3', summary: 'v1’s plants grown up the way fish3 grew the fish: 16 species on nine bend habits, five sizes, three looks, Mendelian pigment, and a name.',
    howItWorks: 'The painter reads a pose; motions set the pose; the habit decides the shape of the bend. phenotype.js turns a genome into the physical numbers a habit’s stroke needs. A v1 `g…` code still opens as the same plant.',
    changes: ['Replaced v1/v2’s procedural skeleton with 16 named species across nine bend habits.', 'Added Mendelian pigment genes, three rendering looks, and name generation.', 'Still reads v1 plant codes.'],
    customize: [],
  },
];

export const VERSIONS = [...SEED_VERSIONS, ...studioVersions];
export const versionsFor = (family) => VERSIONS.filter((v) => v.family === family).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
export const versionById = (id) => VERSIONS.find((v) => v.id === id) ?? null;
export const FAMILIES = [...new Set(VERSIONS.map((v) => v.family))];
