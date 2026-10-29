// fish4's names: fish3's names (unchanged for a fish without fish4 features), plus what feature
// modules add (the helmet's "Cosmonaut …" and an astro- epithet), a nickname from the flavour
// table, and the classification. `params.text.humour` decides how silly a nickname may be.

import { hash01 } from '../../pixel/rng.js';
import { namesOf as namesOf3 } from '../../v3/fish/names.js';
import { toFish3, jitterKey } from './genome.js';
import { extOf } from './bodies/index.js';
import { FEATURES } from './features/registry.js';
import { specificity, test } from './rules.js';
import { taxonomyOf } from './taxonomy.js';
import DEFAULT_FLAVOUR from './data/flavour.js';

/** Every name for a fish4 set; `look` (from stats.js lookFor) answers flavour conditions. */
export function namesOf4(set, { look, humour = 0.5, flavour } = {}) {
  const ext = extOf(set);
  const base = namesOf3(toFish3(set), ext);
  let { common, binomial } = base;
  const keys = [...base.keys];
  for (const f of FEATURES) {
    const value = set[f.id];
    if (!value || value === f.none) continue;
    const n = f.influences?.name;
    if (n?.prefix) common = `${n.prefix} ${common}`;
    if (n?.latin) {
      const [genus, epithet] = binomial.split(' ');
      binomial = `${genus} ${n.latin}${epithet}`;
    }
    const ks = f.influences?.keys ?? {};
    keys.unshift(...(ks[value] ?? []), ...(ks['*'] ?? []));
  }
  const tax = taxonomyOf(toFish3(set), ext);
  const species = binomial.split(' ').slice(1).join(' ');
  const shownBinomial = tax.hybrid ? `× ${binomial}` : binomial;
  const nickname = look ? nicknameOf(set, look, humour, flavour) : null;
  const full = base.title ? `${common}, ${base.title}` : common;
  return {
    ...base,
    common,
    binomial: shownBinomial,
    full,
    keys,
    nickname,
    taxonomy: { ...tax, species, binomial: shownBinomial, full: tax.variety ? `${shownBinomial} ${/^line/.test(tax.variety) ? tax.variety : `var. ${tax.variety}`}` : shownBinomial },
  };
}

/**
 * A nickname: the most specific flavour entry the fish matches, no sillier than `humour`;
 * the name within it picked by the fish's key. Null when humour is 0 and nothing serious fits.
 */
export function nicknameOf(set, look, humour = 0.5, flavour = DEFAULT_FLAVOUR) {
  const key = jitterKey(set);
  const hits = (flavour ?? DEFAULT_FLAVOUR).filter((e) => (e.humour ?? 0) <= humour && test(e.when, look, key));
  if (!hits.length) return null;
  const rank = (e) => (e.priority ?? 0) * 100 + specificity(e.when);
  const best = Math.max(...hits.map(rank));
  const top = hits.filter((e) => rank(e) === best);
  const entry = top[Math.floor(hash01(`${key}:nick`, 1) * top.length)];
  return { id: entry.id, name: entry.names[Math.floor(hash01(`${key}:nick:${entry.id}`, 2) * entry.names.length)] };
}
