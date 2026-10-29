// fish4: fish3's fish with numbers. Deterministic under any params, codes round-trip, f3. and v1
// codes open as the same fish with the same pixels, classic params roll fish3's fish, the new
// anims and the helmet stay inside the window, and params only move odds (never salts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generator, fromCode } from '../src/gen/registry.js';
import gen4, { validateParams, setParam, PARAM_SCHEMA, batch, violations, linkMuls, CONSTRAINTS, KITS, breed4, textFor, fromSeed, frame, fish4Traits as T, toFish3, PRESETS, paramsHash, lociOf, statsOf, behaviourProfile, STATS, STATS_VERSION, profile, ecology4Of, DEFAULT_RULES, NEW_FORMS, speciesKey, windowOf } from '../src/v4/fish/index.js';
import { namesOf } from '../src/v3/fish/names.js';
import { fish3Traits as T3 } from '../src/v3/fish/genome.js';
import { FEATURES } from '../src/v4/fish/features/registry.js';
import { test as when, TIERS } from '../src/v4/fish/rules.js';

const gen3 = generator('fish3');
const same = (a, b) => a.w === b.w && a.h === b.h && a.data.every((v, i) => v === b.data[i]) && a.palette.length === b.palette.length && a.palette.every((c, i) => c.join() === b.palette[i].join());
const drawn = (img) => img.data.reduce((n, v) => n + (v ? 1 : 0), 0);

test('fish4 is registered next to fish3', () => {
  const g = generator('fish4');
  assert.equal(g, gen4);
  assert.equal(g.version, 4);
  assert.equal(g.family, 'fish');
  assert.ok(g.anims.some((a) => a.id === 'dead') && g.anims.some((a) => a.id === 'happy') && g.anims.some((a) => a.id === 'tired'));
});

test('fish4 is deterministic under every preset, and codes round-trip', () => {
  for (const preset of Object.keys(PRESETS)) {
    for (let i = 0; i < 4; i++) {
      const a = fromSeed(`det-${i}`, preset);
      assert.deepEqual(a, fromSeed(`det-${i}`, preset));
      const code = T.encode(a);
      assert.ok(code.startsWith('f4.'));
      assert.deepEqual(fromCode(gen4, code), a);
    }
  }
  assert.ok(same(frame(fromSeed('det-1'), 'swim', 2), frame(fromSeed('det-1'), 'swim', 2)));
});

test('classic params roll fish3 underneath', () => {
  for (let i = 0; i < 60; i++) assert.equal(T3.encode(toFish3(fromSeed(`roll-${i}`, 'classic'))), T3.encode(gen3.fromSeed(`roll-${i}`)), `roll-${i}`);
});

test('f3. and v1 codes open as the same fish, pixel for pixel', () => {
  const v1 = generator('fish');
  for (let i = 0; i < 10; i++) {
    const a3 = gen3.fromSeed(`imp-${i}`);
    const a4 = fromCode(gen4, T3.encode(a3));
    assert.equal(T3.encode(toFish3(a4)), T3.encode(a3));
    for (const [anim, f] of [['swim', 1], ['turn', 5], ['grow', 2]]) assert.ok(same(gen4.frame(a4, anim, f), gen3.frame(a3, anim, f)), `imp-${i} ${anim}`);
    // Same look, same latent genes, every time.
    assert.deepEqual(lociOf(a4), lociOf(fromCode(gen4, T3.encode(a3))));
  }
  const g1 = v1.fromSeed('v1-fish');
  const a4 = fromCode(gen4, v1.traits.encode(g1));
  assert.ok(a4);
  for (const k of Object.keys(g1)) if (T3.fieldById(k)) assert.equal(a4[k], g1[k], k);
});

test('params move odds, not salts: the same seed stays recognisably the same fish', () => {
  let shared = 0;
  let total = 0;
  for (let i = 0; i < 40; i++) {
    const a = fromSeed(`rel-${i}`, 'ecotype');
    const b = fromSeed(`rel-${i}`, 'vivid');
    for (const f of ['body', 'size', 'tail', 'dorsal', 'pattern', 'jaw', 'scales']) {
      total++;
      if (a[f] === b[f]) shared++;
    }
  }
  assert.ok(shared / total > 0.8, `${shared}/${total}`);
  assert.notEqual(paramsHash('classic'), paramsHash('vivid'));
  assert.equal(paramsHash({ base: 'vivid' }), paramsHash('vivid'));
});

test('the vivid preset is more colourful', () => {
  const chromaOf = (p) => Array.from({ length: 80 }, (_, i) => Number(fromSeed(`viv-${i}`, p).chroma.slice(1))).reduce((a, b) => a + b, 0);
  assert.equal(chromaOf('classic'), 0);
  assert.ok(chromaOf('vivid') > 80);
});

test('expressions and the helmet stay inside the window at every size', () => {
  const sizes = ['tiny', 'small', 'medium', 'large', 'huge', 'giant'];
  for (const [k, body] of ['torpedo', 'round', 'koi', 'clown', 'mola', 'betta'].entries()) {
    const set = T.normalize({ ...fromSeed(`win-${k}`), body, size: sizes[k], helmet: ['bubble', 'retro', 'visor', 'antenna'][k % 4], snout: 'blunt' });
    assert.notEqual(set.helmet, 'none');
    const box = gen4.sizeOf(set);
    for (const a of gen4.anims) {
      for (let i = 0; i < a.frames; i++) {
        const img = gen4.frame(set, a.id, i);
        assert.equal(img.w, box.w);
        assert.equal(img.h, box.h);
        assert.ok(drawn(img) > 10, `${body} ${a.id} ${i}`);
      }
    }
  }
});

test('the helmet paints, and only where it is allowed', () => {
  const base = T.normalize({ ...fromSeed('helm'), size: 'large', snout: 'blunt', eyeMount: 'normal' });
  const plain = frame({ ...base, helmet: 'none' }, 'swim', 0);
  const domed = frame({ ...base, helmet: 'bubble' }, 'swim', 0);
  assert.ok(!same(plain, domed));
  assert.equal(T.normalize({ ...base, helmet: 'bubble', eyeMount: 'tubular' }).helmet, 'none');
  for (const f of FEATURES) assert.ok(f.genomeField.salt >= 3072, `${f.id} salt`);
});

test('dead fish float belly up: the frame is the swim pose flipped', () => {
  const set = fromSeed('dead');
  const img = frame(set, 'dead', 0);
  assert.ok(drawn(img) > 10);
  assert.ok(!same(img, frame(set, 'swim', 0)));
});

test('new tiers are appended and draw as their fish3 kin', () => {
  assert.deepEqual(T.fieldById('rarity').choices.map((c) => c.id), ['common', 'uncommon', 'rare', 'myth', 'epic', 'legendary']);
  const epic = T.normalize({ ...fromSeed('tier'), rarity: 'epic', iridescence: 'rainbow' });
  assert.equal(epic.iridescence, 'rainbow');
  assert.equal(toFish3(epic).rarity, 'rare');
  assert.equal(toFish3({ ...epic, rarity: 'myth' }).rarity, 'myth');
  assert.equal(TIERS.length, 6);
});

test('conditions: all, any, not, ranks and deterministic chance', () => {
  const look = (kind, id) => ({ field: { body: 'koi', helmet: 'none' }[id], tier: 'epic', size: 'huge', stat: { boldness: 0.7 }[id] }[kind]);
  assert.ok(when({ all: [{ field: 'body', is: 'koi' }, { tier: '>=rare' }, { size: '>=large' }] }, look));
  assert.ok(!when({ any: [{ field: 'body', in: ['eel', 'mola'] }, { tier: '<rare' }] }, look));
  assert.ok(when({ not: { feature: 'helmet', not: 'none' } }, look));
  assert.ok(when({ stat: 'boldness', between: [0.6, 0.8] }, look));
  const hits = Array.from({ length: 1000 }, (_, i) => when({ chance: 0.25, salt: 'x' }, look, `k${i}`)).filter(Boolean).length;
  assert.ok(hits > 200 && hits < 300, String(hits));
  assert.equal(when({ chance: 0.5, salt: 'y' }, look, 'k1'), when({ chance: 0.5, salt: 'y' }, look, 'k1'));
});

test('every stat is in range, has evidence, and is the same every time', () => {
  for (let i = 0; i < 60; i++) {
    const set = fromSeed(`stat-${i}`, i % 2 ? 'wild' : 'classic');
    const st = statsOf(set);
    assert.deepEqual(st, statsOf(set));
    for (const s of STATS) {
      const x = st[s.id];
      assert.ok(x.value >= 0 && x.value <= 1, `${s.id} ${x.value}`);
      assert.ok(x.because.length >= 1 && x.because[0].source === 'base', s.id);
      if (s.real) assert.ok(x.real >= (x.range ?? s.real)[0] - 1e-9 && x.real <= (x.range ?? s.real)[1] + 1e-9, `${s.id} real`);
    }
    const p = behaviourProfile(set);
    assert.equal(p.v, STATS_VERSION);
    assert.ok(['top', 'mid', 'bottom'].includes(p.zone) && p.groupSize >= 1);
    assert.doesNotThrow(() => JSON.stringify(profile(set)));
  }
});

test('genes move stats: aggression follows its locus, diet rules follow the jaw', () => {
  const base = T.normalize({ ...fromSeed('genes'), form: 'fish3', body: 'tetra', jaw: 'plain', chaos: 'normal' });
  const hot = statsOf({ ...base, aggressionA: 'a15', aggressionB: 'a15' }).aggression.value;
  const cold = statsOf({ ...base, aggressionA: 'a0', aggressionB: 'a0' }).aggression.value;
  assert.ok(hot - cold > 0.3, `${hot} ${cold}`);
  // Dominant-high: one fiery allele shows more than half.
  const het = statsOf({ ...base, aggressionA: 'a15', aggressionB: 'a0' }).aggression.value;
  assert.ok(het > (hot + cold) / 2);
  // A piscivore is more predatory than the same fish as a grazer.
  const fangs = statsOf({ ...base, jaw: 'fangs' });
  const lips = statsOf({ ...base, jaw: 'lips' });
  assert.ok(fangs.predatoryDrive.value > lips.predatoryDrive.value + 0.3);
  assert.ok(fangs.aggression.value > lips.aggression.value);
});

test('rules are data: removing one changes only what it touched; chance rules pick the same fish', () => {
  const set = T.normalize({ ...fromSeed('rule'), jaw: 'fangs' });
  const all = statsOf(set);
  assert.ok(all.rulesFired.includes('piscivore'));
  const without = statsOf(set, { rules: DEFAULT_RULES.filter((r) => r.id !== 'piscivore') });
  assert.ok(without.predatoryDrive.value < all.predatoryDrive.value);
  assert.equal(without.hardiness.value, all.hardiness.value);
  const custom = statsOf(set, { rules: [{ id: 'calm', when: { fact: 'diet', is: 'piscivore' }, then: [{ stat: 'aggression', set: 0.05 }] }] });
  assert.equal(custom.aggression.value, 0.05);
  // Pacifists exist, but rarely, and always the same fish.
  const pacifists = Array.from({ length: 300 }, (_, i) => T.normalize({ ...fromSeed(`pac-${i}`), jaw: 'fangs' })).filter((s) => statsOf(s).rulesFired.includes('pacifist'));
  assert.ok(pacifists.length > 5 && pacifists.length < 50, String(pacifists.length));
  for (const s of pacifists) assert.ok(statsOf(s).rulesFired.includes('pacifist'));
});

test('sterile hybrids have no fertility; rarer tiers mature slower', () => {
  const moon = T.normalize({ ...fromSeed('moon'), form: 'fish3', body: 'mola', hybrid: 'moonblob' });
  if (moon.hybrid === 'moonblob') assert.equal(statsOf(moon).fertility.value, 0);
  const set = fromSeed('tiers');
  assert.ok(statsOf(set, { tier: 'myth' }).maturationMul.value > statsOf(set, { tier: 'common' }).maturationMul.value);
  assert.ok(statsOf(set, { tier: 'myth' }).fertility.value < statsOf(set, { tier: 'common' }).fertility.value);
});

test('taxonomy: fish3 binomials kept, every body has an order and family, hybrids marked', () => {
  const bodies = T.fieldById('body').choices.map((c) => c.id);
  for (const body of bodies) {
    const set = T.normalize({ ...fromSeed(`tax-${body}`, 'classic'), body, hybrid: 'none', helmet: 'none' });
    const p = profile(set);
    assert.ok(p.taxonomy.order.id && p.taxonomy.family.id, body);
    assert.equal(p.names.binomial, namesOf(toFish3(set)).binomial, body);
  }
  const hy = T.normalize({ ...fromSeed('tax-hy'), form: 'fish3', body: 'piranha', hybrid: 'chompball' });
  if (hy.hybrid === 'chompball') assert.ok(profile(hy).names.binomial.startsWith('× '));
});

test('helmets rename (Cosmonaut, astro-) and nicknames respect humour', () => {
  const set = T.normalize({ ...fromSeed('nick'), size: 'large', snout: 'blunt', eyeMount: 'normal', helmet: 'bubble' });
  const p = profile(set);
  assert.ok(p.names.common.startsWith('Cosmonaut '));
  assert.ok(p.names.binomial.split(' ')[1].startsWith('astro'));
  assert.equal(p.names.nickname.id, 'cosmonaut');
  assert.equal(profile(set, { humour: 0 }).names.nickname.id, 'any');
  assert.equal(profile({ ...set, helmet: 'none' }).names.common, namesOf(toFish3(set)).common);
});

// ---------- ecotype: terrains, species, clustering --------------------------------------------

test('ecotype: lava, sand and nuclear fish turn up by default, each in its own terrain', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const f = fromSeed(`ter-${i}`);
    seen.add(f.terrain);
    const rec = NEW_FORMS.find((b) => b.id === f.form);
    if (rec) assert.equal(rec.terrain, f.terrain, `ter-${i}`);
  }
  for (const t of ['water', 'lava', 'sand', 'nuclear']) assert.ok(seen.has(t), t);
  assert.ok(!seen.has('aether'), 'aether is locked by default');
  assert.ok(Array.from({ length: 200 }, (_, i) => fromSeed(`ter-${i}`, 'frontier').terrain).includes('aether'));
  for (let i = 0; i < 100; i++) assert.equal(fromSeed(`wo-${i}`, 'water').terrain, 'water');
});

test('ecotype: fish of one species share a body and most of a look', () => {
  const by = {};
  for (let i = 0; i < 800; i++) {
    const f = fromSeed(`sp-${i}`);
    (by[speciesKey(f)] ??= []).push(f);
  }
  const rate = (pairs, k) => pairs.filter(([a, b]) => a[k] === b[k]).length / pairs.length;
  const within = Object.values(by).flatMap((g) => g.slice(1).map((f) => [g[0], f]));
  const all = Object.values(by).map((g) => g[0]);
  const between = all.flatMap((a, i) => all.slice(i + 1, i + 4).map((b) => [a, b]));
  assert.equal(rate(within, 'form'), 1);
  assert.equal(rate(within, 'body'), 1);
  for (const k of ['pattern', 'tail', 'skin', 'dorsal']) {
    assert.ok(rate(within, k) >= 0.7, `${k} within ${rate(within, k)}`);
    assert.ok(rate(within, k) > 3 * rate(between, k), `${k} within ${rate(within, k)} vs between ${rate(between, k)}`);
  }
  // Cohesion is a dial: at 0 a species shares only its body.
  const loose = { base: 'ecotype', clusters: { cohesion: 0 } };
  const lb = {};
  for (let i = 0; i < 400; i++) {
    const f = fromSeed(`sp-${i}`, loose);
    (lb[speciesKey(f)] ??= []).push(f);
  }
  const lw = Object.values(lb).flatMap((g) => g.slice(1).map((f) => [g[0], f]));
  assert.ok(rate(lw, 'pattern') < rate(within, 'pattern') - 0.2);
});

test('ecotype: a place can be pinned, and mutation pressure raises the sport rate', () => {
  const place = { terrain: 'nuclear', region: 'reactorlake', niche: 'ornament' };
  const neon = (P) => Array.from({ length: 600 }, (_, i) => fromSeed(`mut-${i}`, P, place)).filter((f) => f.morph === 'neon').length;
  for (let i = 0; i < 20; i++) {
    const f = fromSeed(`pin-${i}`, null, place);
    assert.equal(f.region, 'reactorlake');
    assert.equal(f.niche, 'ornament');
  }
  assert.ok(neon({ base: 'ecotype', mutation: { sport: 0.3 } }) > neon({ base: 'ecotype', mutation: { sport: 0 } }) + 20);
});

test('every fish4 body draws at every size, inside its window', () => {
  for (const b of NEW_FORMS) {
    for (const size of ['tiny', 'small', 'medium', 'large', 'huge', 'giant']) {
      const set = T.normalize({ ...fromSeed(`body-${b.id}`, null, { terrain: b.terrain }), form: b.id, body: b.kin, size, hybrid: 'none' });
      const box = windowOf(set);
      for (const anim of ['swim', 'happy', 'dead']) {
        const img = frame(set, anim, 1);
        assert.equal(img.w, box.w, `${b.id} ${size} ${anim}`);
        assert.ok(drawn(img) > 10, `${b.id} ${size} ${anim}`);
      }
    }
  }
});

test('terrain ecology: care in the fish\'s own medium, water fish keep fish3\'s', async () => {
  const { ecologyOf } = await import('../src/v3/fish/ecology.js');
  const { extOf } = await import('../src/v4/fish/index.js');
  for (let i = 0; i < 40; i++) {
    const set = fromSeed(`w${i}`, 'classic');
    const e3 = ecologyOf(toFish3(set), extOf(set));
    const e4 = ecology4Of(set);
    for (const k of Object.keys(e3)) if (k !== 'care') assert.deepEqual(e4[k], e3[k], k);
    assert.deepEqual(e4.care.tempC, e3.care.tempC);
    assert.equal(e4.medium.value, 'water');
  }
  const bands = { lava: [850, 1250], sand: [35, 70], nuclear: [40, 90] };
  for (const [t, band] of Object.entries(bands)) {
    for (let i = 0; i < 12; i++) {
      const set = fromSeed(`t${t}${i}`, 'ecotype', { terrain: t });
      const e = ecology4Of(set);
      assert.equal(e.terrain.value, t);
      assert.deepEqual(e.care.tempC, band);
      const st = statsOf(set);
      assert.ok(st.idealTempC.real >= band[0] && st.idealTempC.real <= band[1], `${t} ${st.idealTempC.real}`);
      if (t !== 'nuclear') assert.equal(st.idealPH.applies, false);
      if (t === 'lava') assert.ok(st.heatTolerance.value >= 0.7, `lava heat ${st.heatTolerance.value}`);
      if (t === 'nuclear') assert.ok(st.radiance.value > 0.3 && st.luminosity.value > 0.3, 'nuclear glows');
    }
  }
  // Sand fish dig more than water fish, on average.
  const mean = (t, id) => Array.from({ length: 60 }, (_, i) => statsOf(fromSeed(`m${t}${i}`, 'ecotype', { terrain: t }))[id].value).reduce((a, b) => a + b) / 60;
  assert.ok(mean('sand', 'burrowing') > mean('water', 'burrowing') + 0.25);
  assert.ok(mean('lava', 'armour') > mean('water', 'armour') + 0.1);
});

test('rarity: continuous points, six tiers, never demoted, mostly common in the wild', async () => {
  const { rarityOf, RARITY_COLORS } = await import('../src/v4/fish/index.js');
  const tally = {};
  for (let i = 0; i < 400; i++) {
    const set = fromSeed(`rar${i}`);
    const r = rarityOf(set);
    assert.deepEqual(r, rarityOf(set));
    assert.ok(r.points >= 0 && r.fraction >= 0 && r.fraction <= 1);
    assert.ok(Math.abs(r.breakdown.reduce((a, b) => a + b.points, 0) - r.points) < 0.05);
    assert.ok(RARITY_COLORS[r.tier]);
    tally[r.computed] = (tally[r.computed] ?? 0) + 1;
  }
  assert.ok(tally.common / 400 > 0.55, JSON.stringify(tally));
  assert.ok((tally.legendary ?? 0) + (tally.myth ?? 0) <= 8, JSON.stringify(tally));
  // An imported Mythic stays Mythic, however plain it looks.
  const plain = { ...fromSeed('plain', 'classic'), rarity: 'myth' };
  assert.equal(rarityOf(plain).tier, 'myth');
});

test('breeding: terrains refuse, forms breed true, loci come from the parents, Mythic is capped', async () => {
  const { breed4, breedClutch, mythicChance, reproduction, canBreed, resolveParams } = await import('../src/v4/fish/index.js');
  const lava = (s) => ({ ...fromSeed(s, 'ecotype', { terrain: 'lava' }), stage: 'adult' });
  const a = lava('ba');
  const w = fromSeed('bw', 'ecotype', { terrain: 'water' });
  assert.ok(breed4(a, w, 'x').problem);
  assert.equal(breed4(a, w, 'x').child, null);
  const b = { ...a, ...Object.fromEntries(Object.entries(lava('bb')).filter(([k]) => k.endsWith('A') || k.endsWith('B'))) };
  let inherited = 0;
  let total = 0;
  for (let i = 0; i < 30; i++) {
    const { child } = breed4(a, b, `egg${i}`);
    assert.deepEqual(child, breed4(a, b, `egg${i}`).child);
    assert.equal(child.form, a.form);
    assert.equal(child.terrain, 'lava');
    assert.equal(child.stage, 'fry');
    for (const l of ['metabolism', 'vigor', 'energy', 'sociability']) {
      total += 2;
      if ([a[`${l}A`], a[`${l}B`]].includes(child[`${l}A`])) inherited += 1;
      if ([b[`${l}A`], b[`${l}B`]].includes(child[`${l}B`])) inherited += 1;
    }
  }
  assert.ok(inherited / total > 0.95, `${inherited}/${total}`);
  const P = resolveParams();
  const cl = breedClutch(a, b, 'c1');
  assert.ok(cl.children.length >= P.breeding.clutchMin && cl.children.length <= P.breeding.clutchMax);
  // Even two saturated Mythics never pass the cap.
  const myth = (s) => ({ ...s, rarity: 'myth', aetherA: 'a15', aetherB: 'a15', morph: 'galaxy', hybrid: 'none' });
  assert.ok(mythicChance(myth(a), myth(b), P) <= P.mythic.maxChance + 1e-12);
  // Rarer fish get fewer broods; a fry cannot breed; a spent fish cannot either.
  assert.ok(reproduction({ ...a, rarity: 'myth' }).broodLimit <= reproduction({ ...a, rarity: 'common' }).broodLimit);
  assert.equal(canBreed({ ...a, stage: 'fry' }).ok, false);
  assert.equal(canBreed(a, reproduction(a).broodLimit).ok, false);
  assert.equal(canBreed(a, 0).ok, true);
});

test('economy: value follows the score, saturation and stage', async () => {
  const { valueOf, rarityOf } = await import('../src/v4/fish/index.js');
  const { genusOf } = await import('../src/v4/fish/economy.js');
  const fish = Array.from({ length: 30 }, (_, i) => ({ ...fromSeed(`v${i}`), stage: 'adult', size: 'medium' })).sort((x, y) => rarityOf(x).points - rarityOf(y).points);
  assert.ok(valueOf(fish[29]).credits > valueOf(fish[0]).credits);
  const f = fish[10];
  assert.ok(valueOf(f, { sales: [genusOf(f), genusOf(f), genusOf(f)] }).credits < valueOf(f).credits);
  assert.ok(valueOf({ ...f, stage: 'fry' }).credits < valueOf(f).credits);
});

test('sim: pacing bands hold and no strategy dominates', async () => {
  const { sweep } = await import('../src/v4/fish/sim.js');
  const s = sweep({ seeds: 4, generations: 60, seed: 'pace' });
  // A smart player plays the fastest way to each tier: bands on the best strategy's median.
  const best = (t) => Math.min(...Object.values(s).map((x) => x.firsts[t]?.gen ?? Infinity));
  assert.ok(best('uncommon') <= 3, `uncommon ${best('uncommon')}`);
  assert.ok(best('rare') >= 2 && best('rare') <= 9, `rare ${best('rare')}`);
  assert.ok(best('epic') >= 3 && best('epic') <= 15, `epic ${best('epic')}`);
  assert.ok(best('legendary') >= 10 && best('legendary') <= 35, `legendary ${best('legendary')}`);
  // Mythic is luck as much as play: one lucky run must not set the band, so count misses too.
  const mythMedian = Math.min(...Object.values(s).map((x) => x.firsts.myth?.medianGen ?? Infinity));
  assert.ok(mythMedian >= 20, `myth ${mythMedian}`);
  const rates = Object.values(s).map((x) => x.perHour).sort((a, b) => b - a);
  assert.ok(rates[0] <= 1.5 * rates[1], `per hour ${rates}`);
});

test('scaled detail: the same fish below large, coarser texture on giants; ecotype fish use it', () => {
  const same = (a, b) => a.data.length === b.data.length && a.data.every((v, i) => v === b.data[i]);
  const fish = (size, detail) => frame({ body: 'carp', scales: 'plates', tail: 'fan', size, stage: 'adult', detail }, 'swim', 2);
  for (const size of ['tiny', 'small', 'medium', 'large']) assert.ok(same(fish(size, 'v3'), fish(size, 'v4')), size);
  assert.ok(!same(fish('giant', 'v3'), fish('giant', 'v4')));
  assert.equal(fromSeed('detail-1').detail, 'v4');
  assert.equal(fromSeed('detail-1', 'classic').detail, 'v3');
});

test('character: deterministic, complete, with evidence, and different across niches', () => {
  const archetypes = new Map();
  for (let i = 0; i < 120; i++) {
    const s = fromSeed(`char-${i}`);
    const c = gen4.character(s);
    assert.deepEqual(JSON.parse(JSON.stringify(gen4.character(s))), JSON.parse(JSON.stringify(c)));
    for (const [id, a] of Object.entries(c.personality)) {
      assert.ok(a.value >= 0 && a.value <= 1, id);
      assert.ok(a.because.length > 0, id);
    }
    assert.ok(c.traits.length >= 3 && c.traits.length <= 5, `${c.traits.length} traits`);
    assert.ok(c.traits.every((t) => t.because));
    assert.ok(c.quirks.length >= 1 && c.quirks.length <= 3);
    if (s.terrain !== 'water') assert.ok(c.quirks.some((q) => /lava|sand|nuc|aether/.test(q.id) || q.id.startsWith(s.terrain)), `${s.terrain} quirk`);
    assert.ok(c.archetype.label && c.social.label && c.care.medium && c.story.species);
    if (s.terrain === 'nuclear') assert.ok(c.care.radiation, 'nuclear fish are radiant');
    const blurb = gen4.blurb(s);
    assert.ok(!/\{|\}|undefined|null|NaN/.test(blurb), blurb);
    const k = s.niche;
    if (!archetypes.has(k)) archetypes.set(k, new Set());
    archetypes.get(k).add(c.archetype.id);
  }
  // Niches lean personality: drifters are calmer than pursuers on average.
  const mean = (niche, axis) => {
    const xs = [];
    for (let i = 0; i < 60; i++) xs.push(gen4.character(fromSeed(`niche-${niche}-${i}`, undefined, { niche, region: niche === 'pursuit' ? 'pelagic' : 'deep', terrain: 'water' })).personality[axis].value);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  assert.ok(mean('pursuit', 'energy') > mean('drifter', 'energy') + 0.05);
});

test('compatibility: other worlds score 0, kin school together, scores in range', () => {
  const lava = fromSeed('cmp', undefined, { terrain: 'lava' });
  const water = fromSeed('cmp', undefined, { terrain: 'water' });
  const x = gen4.compatibility(lava, water);
  assert.equal(x.score, 0);
  assert.match(x.reasons[0].text, /own tank/);
  for (let i = 0; i < 30; i++) {
    const a = fromSeed(`cmp-a${i}`, undefined, { terrain: 'water' });
    const b = fromSeed(`cmp-b${i}`, undefined, { terrain: 'water' });
    const c = gen4.compatibility(a, b);
    assert.ok(c.score >= 0 && c.score <= 1 && c.verdict);
    assert.equal(gen4.compatibility(b, a).score, c.score);
  }
});

test('text: every pool fills, no stray tokens, terrain lines for terrain fish, custom libraries', () => {
  for (let i = 0; i < 80; i++) {
    const s = fromSeed(`text-${i}`);
    const t = gen4.text(s);
    for (const [pool, v] of Object.entries(t)) {
      assert.ok(v && v.text, pool);
      assert.ok(!/\{\w+\}|undefined|NaN/.test(v.text), `${pool}: ${v.text}`);
    }
    if (s.terrain !== 'water' && s.terrain !== 'aether') assert.ok(Object.values(t).some((v) => v.id.includes(s.terrain)), `${s.terrain}: ${Object.values(t).map((v) => v.id)}`);
  }
  const s = fromSeed('text-lib');
  const lib = [{ id: 'mine', pool: 'tagline', when: true, lines: ['Hello, {archetype}.'] }];
  assert.match(textFor(s, 'tagline', { library: lib }).text, /^Hello, [a-z-]+\.$/);
  // Nothing matches: fish3's lore fills in.
  assert.ok(textFor(s, 'codex', { library: lib }).id.startsWith('lore:'));
});

test('links: deterministic, they fire, and they move the odds they name', () => {
  // Links act on species, so count over many: the share of fish that meet `when` and carry `c`.
  const share = (params, when, ok) => {
    let hit = 0;
    let n = 0;
    for (let i = 0; i < 2000; i++) {
      const s = fromSeed(`lk-${i}`, params);
      if (!when(s)) continue;
      n++;
      hit += ok(s) ? 1 : 0;
    }
    return hit / n;
  };
  const on = { base: 'ecotype' };
  const off = { base: 'ecotype', links: { strength: 0 } };
  assert.deepEqual(fromSeed('link-a', on), fromSeed('link-a', on));
  const deep = (s) => s.region === 'deep' || s.region === 'icemoon';
  assert.ok(share(on, deep, (s) => s.belly === 'pale') > share(off, deep, (s) => s.belly === 'pale') + 0.15, 'deep-pale');
  const veil = (s) => ['veil', 'streamer', 'lyre'].includes(s.tail);
  assert.ok(share(on, veil, (s) => s.dorsal === 'tall') > share(off, veil, (s) => s.dorsal === 'tall') + 0.1, 'veil-slow');
  const { fired } = linkMuls(fromSeed('link-b', on, { terrain: 'nuclear' }), PRESETS.ecotype);
  assert.ok(fired.includes('nuclear-glow'));
  assert.deepEqual(linkMuls(fromSeed('link-b', on), { ...PRESETS.ecotype, links: { strength: 0 } }).fired, []);
  assert.ok(!linkMuls({ terrain: 'sand', dorsal: 'low' }, { links: { off: ['sand-flat'] } }).fired.includes('sand-flat'));
});

test('guard: no guarded combination across 2,000 seeds, and every guard can be switched off', () => {
  for (let i = 0; i < 2000; i++) {
    const s = fromSeed(`guard-${i}`);
    assert.deepEqual(violations(s, PRESETS.ecotype), [], `guard-${i}`);
  }
  const bad = { size: 'tiny', dorsal: 'venom', tail: 'sword', terrain: 'water' };
  assert.deepEqual(violations(bad, PRESETS.ecotype), ['tiny-arsenal']);
  assert.deepEqual(violations(bad, { guard: { off: ['tiny-arsenal'] } }), []);
  assert.deepEqual(violations(bad, { guard: { enabled: false } }), []);
  for (const c of CONSTRAINTS) assert.ok(c.id && c.when && c.fix && c.note, c.id);
});

test('breeding kits: with kitChance 1 each kit comes whole from one parent', () => {
  const P = { base: 'ecotype', links: { kitChance: 1 } };
  const a = fromSeed('kit-a', null, { region: 'reef' });
  const b = fromSeed('kit-b', null, { region: 'reef' });
  for (let i = 0; i < 20; i++) {
    const c = breed4(a, b, `kit-${i}`, P).child;
    for (const kit of KITS) {
      const whole = (p) => kit.fields.every((f) => c[f] === T.normalize(p)[f]);
      assert.ok(whole(a) || whole(b), `${kit.id} ${i}`);
    }
  }
});

test('batch: one terrain, a trophic pyramid, several species, schools of one species', () => {
  for (const pin of [{}, { terrain: 'lava' }, { terrain: 'sand' }, { terrain: 'nuclear' }, { region: 'reef' }]) {
    const b = batch('shop', 30, null, pin);
    assert.deepEqual(batch('shop', 30, null, pin), b);
    assert.equal(b.fish.length, 30);
    if (pin.terrain) assert.equal(b.place.terrain, pin.terrain);
    assert.ok(b.fish.every((f) => f.set.terrain === b.place.terrain), 'one terrain');
    if (pin.region) assert.ok(b.fish.every((f) => f.set.region === pin.region));
    const [base, mid, top] = b.pyramid;
    assert.ok(base >= mid && mid >= top, `pyramid ${b.pyramid}`);
    assert.ok(b.species >= 4, `species ${b.species}`);
    // A school is one species, and some schools have more than one fish.
    const schools = Map.groupBy(b.fish, (f) => f.school);
    for (const fs of schools.values()) assert.equal(new Set(fs.map((f) => f.species)).size, 1);
    assert.ok([...schools.values()].some((fs) => fs.length >= 3), 'a shoal');
    for (const f of b.fish) assert.equal(speciesKey(f.set), f.species);
  }
});

test('params schema: every preset validates, every knob is described, typos and bad values are caught', () => {
  for (const [id, p] of Object.entries(PRESETS)) {
    const r = validateParams(p);
    assert.ok(r.ok, `${id}: ${JSON.stringify(r.errors)}`);
    assert.deepEqual(r.warnings.filter((w) => !/reserved/.test(w.message)), [], id);
  }
  for (const s of PARAM_SCHEMA) assert.ok(s.path && s.type && s.label && s.group, s.path);
  const bad = validateParams({ clusters: { cohesion: 2 }, terrains: { mud: 1 }, weights: { tail: { wings: 2 } }, links: { off: ['nope'] } });
  assert.deepEqual(bad.errors.map((e) => e.path).sort(), ['clusters.cohesion', 'links.off', 'terrains.mud', 'weights.tail.wings']);
  assert.deepEqual(validateParams({ cohesion: 1 }).warnings.map((w) => w.path), ['cohesion']);
  assert.ok(!validateParams({ base: 'water', terrains: { water: 0 } }).ok, 'no terrain left');
  assert.ok(!validateParams('nope').ok);
  // A set param steers the roll: no links, no link ids fired.
  const P = setParam({ base: 'ecotype' }, 'links.strength', 0);
  assert.equal(P.links.strength, 0);
  assert.notDeepEqual(fromSeed('steer-1', P), fromSeed('steer-1'));
});
