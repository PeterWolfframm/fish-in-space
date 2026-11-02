// Versions panel: the Algorithm Version History (pixelforge's src/gen/versions.js) for the
// currently selected generator's family — a timeline of named checkpoints, each with how it works
// and how to customize it, a side-by-side render of one seed across every version, a shallow
// params diff between two versions of the same generator, that generator's real git log, and a
// "fork as new version" save into the versions.studio.json companion.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { versionsFor } from '@studio-forge/gen/versions.js';
import type { StudioGen } from './gens';
import { genById } from './gens';
import { seed } from './state';
import { Sprite } from './sprite';

interface Version {
  id: string;
  family: string;
  generator: string;
  algo?: string;
  preset?: string;
  tuning?: unknown;
  date: string;
  commit?: string;
  title: string;
  summary: string;
  howItWorks: string;
  changes: string[];
  customize: { path: string; note: string }[];
}

/** Where each generator's source lives under the forge root, for /api/studio/history?dir=. Mirrors scripts/vendor-forge.mjs's COPY list. */
const SRC_DIR: Record<string, string> = {
  pilot: 'gen', fish: 'gen', waterplant: 'gen', plant: 'gen', plant32: 'gen',
  pilot2: 'v2/pilot', fish2: 'v2/fish', plant2: 'v2/plant', waterplant2: 'v2/waterplant',
  fish3: 'v3/fish', plant3: 'v3/plant', fish4: 'v4/fish',
};

function diffParams(a: unknown, b: unknown, path = ''): { path: string; a: unknown; b: unknown }[] {
  if (a === b) return [];
  const aIsObj = a && typeof a === 'object' && !Array.isArray(a);
  const bIsObj = b && typeof b === 'object' && !Array.isArray(b);
  if (!aIsObj || !bIsObj) {
    const av = JSON.stringify(a);
    const bv = JSON.stringify(b);
    return av === bv ? [] : [{ path: path || '(root)', a, b }];
  }
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
  const out: { path: string; a: unknown; b: unknown }[] = [];
  for (const k of [...keys].sort()) {
    out.push(...diffParams((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k));
  }
  return out;
}

function VersionCard({ gen, v, zoom }: { gen: StudioGen; v: Version; zoom: number }) {
  const [error, setError] = useState<string | null>(null);
  const genome = useMemo(() => {
    try {
      const g = genById(v.generator);
      if (!g) throw new Error(`unknown generator ${v.generator}`);
      setError(null);
      return { g, genome: g.fromSeed(seed.value, v.preset) };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [v, seed.value]);

  return (
    <div class="studio-version-card">
      <div class="studio-stage" style={{ background: gen.bg, minHeight: '8rem' }}>
        {genome ? <Sprite gen={genome.g} genome={genome.genome} animId={genome.g.anims[0]?.id ?? ''} zoom={zoom} /> : <div class="studio-sprite-error">{error}</div>}
      </div>
      <div class="studio-anatomy-tile-label mono">{v.title}</div>
      <div class="note">{v.date}</div>
    </div>
  );
}

function Timeline({ versions, selected, onSelect }: { versions: Version[]; selected: string; onSelect: (id: string) => void }) {
  return (
    <div class="studio-version-timeline">
      {versions.map((v) => (
        <button key={v.id} class={`btn small ${v.id === selected ? 'primary' : 'ghost'}`} type="button" onClick={() => onSelect(v.id)} title={v.summary}>
          {v.date} · {v.title}
        </button>
      ))}
    </div>
  );
}

function GitLog({ dir }: { dir: string }) {
  const [entries, setEntries] = useState<{ hash: string; date: string; subject: string }[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    fetch(`/api/studio/history?dir=${encodeURIComponent(dir)}`)
      .then((r) => r.json())
      .then((j) => !cancelled && setEntries(j.entries ?? []))
      .catch(() => !cancelled && setEntries([]));
    return () => {
      cancelled = true;
    };
  }, [dir]);

  if (!entries) return <div class="note">loading git log…</div>;
  if (!entries.length) return <div class="note">no git log available (not a checkout, or dev server not running)</div>;
  return (
    <ul class="studio-version-gitlog mono">
      {entries.map((e) => (
        <li key={e.hash}>
          {e.hash} {e.date} — {e.subject}
        </li>
      ))}
    </ul>
  );
}

function ForkForm({ gen, onDone }: { gen: StudioGen; onDone: () => void }) {
  const presets: string[] = gen.params?.presets ? Object.keys(gen.params.presets) : [];
  const [preset, setPreset] = useState(presets[0] ?? '');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  if (!gen.params) return <div class="note">{gen.label} has no params to fork — nothing to save as a new version.</div>;

  const submit = async () => {
    if (!title.trim()) {
      setStatus('give it a title first');
      return;
    }
    const id = `${gen.family ?? gen.id}-${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    const entry: Version = {
      id, family: gen.family ?? gen.id, generator: gen.id, preset,
      date: new Date().toISOString().slice(0, 10), title: title.trim(),
      summary: summary.trim() || `Forked from the ${preset} preset in the Studio.`,
      howItWorks: '', changes: [], customize: [],
    };
    setStatus('saving…');
    try {
      const res = await fetch('/api/studio/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file: 'gen/versions.studio.json', entry }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? res.statusText);
      setStatus('saved — reload the Studio to see it on the timeline');
      onDone();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div class="studio-version-fork">
      <div class="row">
        <select value={preset} onChange={(e) => setPreset((e.currentTarget as HTMLSelectElement).value)}>
          {presets.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input class="studio-seed" type="text" placeholder="title" value={title} onChange={(e) => setTitle((e.currentTarget as HTMLInputElement).value)} />
      </div>
      <input class="studio-seed" style={{ width: '100%' }} type="text" placeholder="summary (optional)" value={summary} onChange={(e) => setSummary((e.currentTarget as HTMLInputElement).value)} />
      <div class="row">
        <button class="btn small primary" type="button" onClick={submit}>
          fork as new version
        </button>
        {status && <span class="note">{status}</span>}
      </div>
    </div>
  );
}

export function VersionsPanel({ gen, animId: _animId }: { gen: StudioGen; genome: unknown; animId: string }) {
  const family = gen.family ?? gen.id;
  const versions = useMemo(() => versionsFor(family) as Version[], [family]);
  const [selected, setSelected] = useState(versions[versions.length - 1]?.id ?? '');
  const [compareB, setCompareB] = useState('');
  const [zoom, setZoom] = useState(3);
  const [forkOpen, setForkOpen] = useState(false);

  useEffect(() => {
    setSelected(versions[versions.length - 1]?.id ?? '');
    setCompareB('');
  }, [family]);

  if (!versions.length) return <div class="empty">No version history for {gen.label} yet.</div>;

  const v = versions.find((x) => x.id === selected) ?? versions[versions.length - 1];
  const vB = versions.find((x) => x.id === compareB) ?? null;
  const dir = SRC_DIR[v.generator] ?? '';

  const diff = useMemo(() => {
    if (!vB || vB.generator !== v.generator) return null;
    const gv = genById(v.generator);
    if (!gv?.params) return null;
    const a = gv.params.resolve(v.preset ?? v.algo);
    const b = gv.params.resolve(vB.preset ?? vB.algo);
    return diffParams(a, b);
  }, [v, vB]);

  return (
    <div class="studio-versions">
      <div class="studio-toolbar row">
        <label class="row">
          zoom
          <input type="range" min={1} max={8} value={zoom} onChange={(e) => setZoom(Number((e.currentTarget as HTMLInputElement).value))} />
          <span class="numeral">{zoom}×</span>
        </label>
        <span class="note">seed {seed.value} — change it in Forge</span>
      </div>

      <section>
        <h3>Timeline — {family}</h3>
        <Timeline versions={versions} selected={v.id} onSelect={setSelected} />
      </section>

      <section>
        <h3>{v.title}</h3>
        <p>{v.summary}</p>
        <p class="note">{v.howItWorks}</p>
        {v.changes.length > 0 && (
          <ul>
            {v.changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        )}
        {v.customize.length > 0 && (
          <>
            <h4>Customize</h4>
            <ul class="mono">
              {v.customize.map((c) => (
                <li key={c.path}>
                  <strong>{c.path}</strong> — {c.note}
                </li>
              ))}
            </ul>
          </>
        )}
        {v.commit && <div class="note mono">commit {v.commit}</div>}
      </section>

      <section>
        <h3>Side by side — seed {seed.value} across every version</h3>
        <div class="studio-anatomy-grid">
          {versions.map((vv) => (
            <VersionCard key={vv.id} gen={gen} v={vv} zoom={zoom} />
          ))}
        </div>
      </section>

      <section>
        <h3>Compare params</h3>
        <div class="row">
          <span class="note">vs.</span>
          <select value={compareB} onChange={(e) => setCompareB((e.currentTarget as HTMLSelectElement).value)}>
            <option value="">(pick a version)</option>
            {versions
              .filter((x) => x.id !== v.id)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
          </select>
        </div>
        {compareB && !vB && <div class="note">version not found</div>}
        {vB && !diff && <div class="note">{vB.generator !== v.generator ? 'different generators — render only, no shared params to diff' : 'this generator has no params to diff'}</div>}
        {diff && diff.length === 0 && <div class="note">identical params</div>}
        {diff && diff.length > 0 && (
          <ul class="mono studio-version-diff">
            {diff.map((d) => (
              <li key={d.path}>
                <strong>{d.path}</strong>: {JSON.stringify(d.a)} → {JSON.stringify(d.b)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3>Git log — {dir || v.generator}</h3>
        {dir ? <GitLog dir={dir} /> : <div class="note">no known source dir for {v.generator}</div>}
      </section>

      <section>
        <h3>Fork as new version</h3>
        {!forkOpen ? (
          <button class="btn small ghost" onClick={() => setForkOpen(true)}>
            fork the current generator's active preset
          </button>
        ) : (
          <ForkForm gen={gen} onDone={() => setForkOpen(false)} />
        )}
        <p class="note">
          "Make game default" (params.js's <code>DEFAULT_PRESET</code>) is hand-written source, outside what the Studio's allowlisted save can touch — set it by hand in pixelforge and re-vendor.
        </p>
      </section>
    </div>
  );
}
