const KEY = 'pixelforge.theme';

export function readTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* ignore */
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
}

export function toggleTheme(): 'light' | 'dark' {
  const next = readTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
