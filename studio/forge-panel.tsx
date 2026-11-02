// Forge panel: pick a seed and a generator, see it animate live, tweak its traits and (where it
// has one, currently fish4 only) its generation params.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { GENS, genById } from './gens';
import { genId, seed, animId, zoom, playing, newSeed } from './state';
import { Anim } from './sprite';
import { TraitForm } from './trait-form';
import { ParamsForm } from './params-form';

/** Nudge the seed's trailing number, so ◀▶ step through nearby fish instead of random ones. */
function stepSeed(dir: 1 | -1) {
  const m = seed.value.match(/(\d+)$/);
  if (m && m.index != null) {
    const n = Math.max(0, parseInt(m[1], 10) + dir);
    seed.value = seed.value.slice(0, m.index) + n;
  } else {
    seed.value = `${seed.value}${dir > 0 ? 1 : 0}`;
  }
}

export function ForgePanel() {
  const gen = genById(genId.value);
  const [params, setParams] = useState<unknown>(undefined);
  const [overrides, setOverrides] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    setParams(undefined);
    setOverrides(null);
  }, [genId.value]);
  useEffect(() => setOverrides(null), [seed.value, params]);

  if (!gen) return <div class="empty">No generators registered.</div>;

  const rolled = useMemo(() => gen.fromSeed(seed.value, params), [gen, seed.value, params]);
  const genome = overrides ? (gen.normalize ? gen.normalize({ ...rolled, ...overrides }) : { ...rolled, ...overrides }) : rolled;
  const code = gen.traits?.encode ? gen.traits.encode(genome) : null;

  return (
    <div class="studio-forge">
      <div class="studio-forge-layout">
        <section class="panel">
          <div class="studio-toolbar row">
        <select value={gen.id} onChange={(e) => (genId.value = (e.currentTarget as HTMLSelectElement).value)}>
          {GENS.map((g) => (
            <option value={g.id} key={g.id}>
              {g.label} ({g.kind})
            </option>
          ))}
        </select>
        <input class="studio-seed" type="text" value={seed.value} onChange={(e) => (seed.value = (e.currentTarget as HTMLInputElement).value)} />
        <button class="btn small ghost" onClick={() => stepSeed(-1)}>
          ◀
        </button>
        <button class="btn small ghost" onClick={() => stepSeed(1)}>
          ▶
        </button>
        <button class="btn small primary" type="button" onClick={newSeed}>
          🎲 random
        </button>
      </div>
      <div class="studio-toolbar row">
        <select value={animId.value} onChange={(e) => (animId.value = (e.currentTarget as HTMLSelectElement).value)}>
          {gen.anims.map((a) => (
            <option value={a.id} key={a.id}>
              {a.label ?? a.id}
            </option>
          ))}
        </select>
        <label class="row">
          <input type="checkbox" checked={playing.value} onChange={(e) => (playing.value = (e.currentTarget as HTMLInputElement).checked)} /> playing
        </label>
        <label class="row">
          zoom
          <input type="range" min={1} max={12} value={zoom.value} onChange={(e) => (zoom.value = Number((e.currentTarget as HTMLInputElement).value))} />
          <span class="numeral">{zoom.value}×</span>
        </label>
      </div>
      <div class="studio-stage" style={{ background: gen.bg }}>
        <Anim gen={gen} genome={genome} animId={animId.value} zoom={zoom.value} playing={playing.value} opts={params} />
      </div>
      {code && <div class="studio-code mono">{code}</div>}
        </section>
        <div class="studio-side">
          <div class="studio-columns">
            {gen.traits && (
              <section class="panel">
                <div class="panel-head">
                  <h3>Traits</h3>
                </div>
                <TraitForm traits={gen.traits} set={genome} onChange={setOverrides} />
              </section>
            )}
            {gen.params && (
              <section class="panel">
                <ParamsForm cap={gen.params} params={params} onChange={setParams} />
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
