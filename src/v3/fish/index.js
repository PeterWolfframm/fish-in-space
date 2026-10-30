// Fish v3 (fish3): v1's cute fish, grown up. 32 bodies plus bred hybrids, six size classes at
// constant pixel density, a physically modelled swim in three looks (raised camera, pure side,
// cartoon wag), Mendelian colour genes, lines and sports when bred, and names, ecology and lore
// read off the body.
// Reads v1 fish codes too: the same fish, upgraded.

import { fish3Traits, fromV1Code, jitterKey } from './genome.js';
import { BODIES } from './bodies.js';
import { phenotype, CLASS_LEN, describeGenes } from './phenotype.js';
import { drawFish3, PARTS } from './draw.js';
import { breed, breedDetailed } from './breeding.js';
import { nameOf, namesOf } from './names.js';
import { loreOf, loreText } from './lore.js';
import { ecologyOf, describeEcology } from './ecology.js';
import { keyed } from './keys.js';
import { anim, poseAt } from '../../v2/anim/rig.js';
import { cruise, sprint, burstCoast, loiter, uTurn, feed, blinkOnce, lookBack, glowBreath, sheenSweep, lifeStages } from './motions.js';
import { roundUp, crop } from '../../v2/kit/sizes.js';
import { roller } from '../../pixel/rng.js';
import { rarityScore } from '../../gen/fish/genome.js';

export { fish3Traits, fromV1Code, phenotype, CLASS_LEN, drawFish3, breedDetailed, nameOf, namesOf, describeGenes, loreOf, loreText, ecologyOf, describeEcology };

const T = fish3Traits;

/** A fresh fish. Bodies lean toward their own looks (a piranha is usually grumpy and grey). */
function fromSeed(seed) {
  const set = T.fromSeed(seed);
  const prefer = BODIES[set.body]?.prefer;
  if (prefer) {
    const { chance } = roller(seed, 3300);
    Object.entries(prefer).forEach(([f, v], i) => {
      if (chance(0.6, i)) set[f] = v;
    });
  }
  return T.normalize(set);
}

export const ANIMS = [
  anim('swim', 8, 10, [cruise({ beats: 1 }), sheenSweep(), glowBreath(), blinkOnce({ at: 0.75, len: 0.125 })]),
  anim('sprint', 8, 16, [sprint({ beats: 2 }), sheenSweep()]),
  anim('glide', 12, 10, [burstCoast({ burst: 0.4 }), glowBreath()]),
  anim('idle', 12, 6, [loiter(), blinkOnce({ at: 0.62, len: 0.09 }), lookBack({ at: 0.2, len: 0.25 }), glowBreath()]),
  anim('turn', 12, 10, [cruise({ beats: 2, amp: 0.6 }), uTurn()]),
  anim('eat', 8, 8, [loiter({ bob: 0 }), feed({ bites: 2 }), glowBreath()]),
  anim('grow', 4, 2, [lifeStages()], { loop: false, label: 'grow (fry → elder)' }),
];

/** Swim speed: small fish beat faster (tail-beat frequency scales about with length^-0.5). */
const fpsOf = (genome, a) => {
  if (a.id === 'grow') return a.fps;
  const L = CLASS_LEN[T.normalize(genome).size] ?? 27;
  return Math.max(4, Math.min(24, Math.round(a.fps * Math.sqrt(27 / L))));
};

const poseOf = (set, a, i) => keyed(poseAt('fish3', a, i, set), set.hybrid !== 'none' ? set.hybrid : set.body, a.id, i);

// Breeding bookkeeping that never reaches the paint: changing it alone can't move a pixel, so the
// window cache can ignore it. (Verified empirically — see scratchpad audit; every other field,
// including ones that look purely cosmetic, feeds the per-fish jitter seed and can nudge the
// painted extent by a pixel.)
const WINDOW_BOOKKEEPING = ['chaos', 'generation', 'lineA', 'lineB', 'purity'];
const windowKey = (set) => {
  const plain = { ...set };
  for (const id of WINDOW_BOOKKEEPING) plain[id] = T.fieldById(id).default ?? T.fieldById(id).choices[0].id;
  return T.encode(plain);
};

/** Every frame of a fish shares one window: the union of where it ever paints, plus a border. */
const boxCache = new Map();
function windowOf(set) {
  const code = windowKey(set);
  const hit = boxCache.get(code);
  if (hit) return hit;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let W = 0;
  let H = 0;
  for (const a of ANIMS) {
    for (let i = 0; i < a.frames; i++) {
      const { img } = drawFish3(set, poseOf(set, a, i));
      W = img.w;
      H = img.h;
      for (let y = 0; y < img.h; y++) {
        for (let x = 0; x < img.w; x++) {
          if (!img.data[y * img.w + x]) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
  }
  const w = roundUp(x1 - x0 + 3);
  const h = roundUp(y1 - y0 + 3);
  // Centre the painted box in the rounded window.
  const box = { x: x0 - 1 - Math.floor((w - (x1 - x0 + 3)) / 2), y: y0 - 1 - Math.floor((h - (y1 - y0 + 3)) / 2), w, h, W, H };
  if (boxCache.size > 300) boxCache.clear();
  boxCache.set(code, box);
  return box;
}

/** One representative canvas per class, from a plain torpedo of that size. */
let SIZES_MEMO = null;
const sizesOf = () => (SIZES_MEMO ??= Object.keys(CLASS_LEN).map((id) => {
  const { w, h } = windowOf(T.normalize({ body: 'torpedo', size: id }));
  return { id, w, h };
}));

export default {
  id: 'fish3',
  version: 3,
  family: 'fish',
  generation: 'old',
  label: 'Fish v3',
  game: 'fish.',
  get size() {
    return sizesOf().find((s) => s.id === 'medium');
  },
  get sizes() {
    return sizesOf();
  },
  sizeField: 'size',
  sizeOf: (genome) => {
    const { w, h } = windowOf(T.normalize(genome));
    return { w, h };
  },
  anchor: 'center',
  bg: '#1e3c5a',
  traits: T,
  fromSeed,
  fromCode: (code) => T.decode(code) ?? fromV1Code(code),
  normalize: T.normalize,
  breed,
  breedDetailed,
  name: (genome) => nameOf(genome),
  describe: (genome) => describeGenes(T.normalize(genome)),
  names: (genome) => namesOf(genome),
  ecology: (genome) => ecologyOf(genome),
  lore: (genome) => loreOf(genome),
  signatureOf: (genome) => {
    const ph = phenotype(genome);
    const label = (f, id) => T.fieldById(f).choices.find((c) => c.id === id)?.label ?? id;
    return { signature: ph.signature, relic: ph.relic, label: [ph.relic !== 'none' && label('relic', ph.relic), ph.signature !== 'none' && label('signature', ph.signature)].filter(Boolean).join(' · ') };
  },
  fpsOf,
  rarity: rarityScore,
  anims: ANIMS,
  /** `opts.enabled(id)` toggles a part off (the studio's Anatomy panel); the window stays the full fish's. */
  frame(genome, animId, i = 0, opts) {
    const set = T.normalize(genome);
    const a = ANIMS.find((x) => x.id === animId) ?? ANIMS[0];
    const box = windowOf(set);
    const { img } = drawFish3(set, poseOf(set, a, i), undefined, opts);
    return crop(img, box.x, box.y, box.w, box.h);
  },
  /** Every paint-order layer id the studio's Anatomy panel can toggle or solo. */
  layers: { ids: PARTS.map((p) => p.id) },
};

export { jitterKey };
