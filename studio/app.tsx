import './studio.css';
import { useEffect, useState } from 'preact/hooks';
import { ForgePanel } from './forge-panel';
import { AnatomyPanel } from './anatomy-panel';
import { GrowthPanel } from './growth-panel';
import { VersionsPanel } from './versions-panel';
import { genById } from './gens';
import { genId, seed, animId, mode, type StudioMode } from './state';
import { applyTheme, readTheme, toggleTheme } from './theme';

const TABS: { id: StudioMode; label: string }[] = [
  { id: 'forge', label: 'Forge' },
  { id: 'anatomy', label: 'Anatomy' },
  { id: 'growth', label: 'Growth' },
  { id: 'versions', label: 'Versions' },
];

export function App() {
  const gen = genById(genId.value);
  const genome = gen ? gen.fromSeed(seed.value) : null;
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div class="studio-shell">
      <header class="top">
        <a class="logo" href="/">
          PixelForge
        </a>
        <nav class="tabs" aria-label="Studio views">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={mode.value === t.id ? 'page' : undefined}
              onClick={() => (mode.value = t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div class="tools">
          <button
            class="icon-btn"
            type="button"
            aria-label={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            onClick={() => setTheme(toggleTheme())}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </header>
      <div class="studio-subhead">
        <h2>Algorithm Studio</h2>
        <span class="hint">Dev tool — live generator source in this repo</span>
      </div>
      <main class="studio-main">
        {mode.value === 'forge' && <ForgePanel />}
        {mode.value === 'anatomy' && gen && genome && <AnatomyPanel gen={gen} genome={genome} animId={animId.value} />}
        {mode.value === 'growth' && gen && genome && <GrowthPanel gen={gen} genome={genome} animId={animId.value} />}
        {mode.value === 'versions' && gen && genome && <VersionsPanel gen={gen} genome={genome} animId={animId.value} />}
      </main>
    </div>
  );
}
