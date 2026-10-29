// The air forces a pilot can fly for: name, era, colours, the helmets the crew room hands out, and
// the national insignia drawn as SVG primitives (roundel and flag patch). Pure: strings only.
//
// WW2 Germany wears the Balkenkreuz only; no other symbol of that state is drawn anywhere here.

/** Eras a pilot can come from. */
export const ERAS = [
  { id: 'modern', label: 'Modern' },
  { id: 'coldwar', label: 'Cold War' },
  { id: 'ww2', label: 'WW2' },
];

// Flags: `h` horizontal or `v` vertical bands, `nordic` cross, or a special painter
const H = (...colors) => ({ kind: 'h', colors });
const V = (...colors) => ({ kind: 'v', colors });
const NORDIC = (field, cross, inner = null) => ({ kind: 'nordic', colors: [field, cross, inner] });

const MODERN_US = ['hgu55', 'jhmcs', 'scorpion'];
const MODERN_EU = ['typhoon', 'hgu55', 'jhmcs'];
const COLD_WEST = ['aph5', 'hgu55'];
const RUSSIAN = ['zsh7'];

/**
 * `roundel`: { kind, ... } painted by roundelSvg. `helmets`: headgear per era for the generator.
 * `shells`/`suits`: paint and flight-suit colour ids (avatar-spec PAINT / SUIT). `lang`: name table.
 */
export const NATIONS = [
  { id: 'usaf', name: 'United States Air Force', short: 'USAF', eras: ['modern', 'coldwar'], lang: 'en', roundel: { kind: 'starbar', disc: '#22336b', star: '#ffffff', bar: '#ffffff', stripe: '#b22234' }, flag: { kind: 'usa' }, helmets: { modern: MODERN_US, coldwar: COLD_WEST }, shells: ['white', 'lightgrey', 'gunship', 'olive'], suits: ['sage', 'olive', 'tan'], accent: '#22336b' },
  { id: 'usn', name: 'US Navy / Marine Corps', short: 'USN', eras: ['modern', 'coldwar'], lang: 'en', roundel: { kind: 'starbar', disc: '#22336b', star: '#ffffff', bar: '#ffffff', stripe: '#b22234' }, flag: { kind: 'usa' }, helmets: { modern: MODERN_US, coldwar: COLD_WEST }, shells: ['white', 'gunship', 'gold', 'navy'], suits: ['sage', 'olive', 'navy'], accent: '#c9a227' },
  { id: 'raf', name: 'Royal Air Force', short: 'RAF', eras: ['modern', 'coldwar'], lang: 'en', roundel: { kind: 'rings', rings: ['#1f3e8f', '#ffffff', '#c8102e'] }, flag: { kind: 'uk' }, helmets: { modern: ['typhoon', 'jhmcs'], coldwar: COLD_WEST }, shells: ['white', 'lightgrey', 'gunship'], suits: ['sage', 'grey', 'olive'], accent: '#1f3e8f' },
  { id: 'fra', name: "Armée de l'Air et de l'Espace", short: 'FRA', eras: ['modern', 'coldwar'], lang: 'fr', roundel: { kind: 'rings', rings: ['#c8102e', '#ffffff', '#1f3e8f'] }, flag: V('#1f3e8f', '#ffffff', '#c8102e'), helmets: { modern: MODERN_EU, coldwar: COLD_WEST }, shells: ['white', 'lightgrey', 'navy'], suits: ['sage', 'olive', 'navy'], accent: '#1f3e8f' },
  { id: 'deu', name: 'Luftwaffe', short: 'GAF', eras: ['modern', 'coldwar'], lang: 'de', roundel: { kind: 'pattee' }, flag: H('#111111', '#dd0000', '#ffce00'), helmets: { modern: MODERN_EU, coldwar: COLD_WEST }, shells: ['white', 'lightgrey', 'gunship', 'olive'], suits: ['olive', 'sage', 'grey'], accent: '#111111' },
  { id: 'ita', name: 'Aeronautica Militare', short: 'ITA', eras: ['modern', 'coldwar'], lang: 'it', roundel: { kind: 'rings', rings: ['#009246', '#ffffff', '#ce2b37'] }, flag: V('#009246', '#ffffff', '#ce2b37'), helmets: { modern: MODERN_EU, coldwar: COLD_WEST }, shells: ['white', 'lightgrey', 'navy'], suits: ['sage', 'grey', 'navy'], accent: '#009246' },
  { id: 'pol', name: 'Polish Air Force', short: 'POL', eras: ['modern', 'coldwar'], lang: 'pl', roundel: { kind: 'checker', a: '#dc143c', b: '#ffffff' }, flag: H('#ffffff', '#dc143c'), helmets: { modern: ['hgu55', 'jhmcs', 'zsh7'], coldwar: RUSSIAN }, shells: ['white', 'lightgrey', 'gunship'], suits: ['sage', 'olive', 'grey'], accent: '#dc143c' },
  { id: 'nld', name: 'Royal Netherlands Air Force', short: 'RNLAF', eras: ['modern', 'coldwar'], lang: 'nl', roundel: { kind: 'rings', rings: ['#ae1c28', '#ffffff', '#21468b', '#ff7f00'] }, flag: H('#ae1c28', '#ffffff', '#21468b'), helmets: { modern: MODERN_US, coldwar: COLD_WEST }, shells: ['white', 'lightgrey', 'orange'], suits: ['sage', 'olive', 'grey'], accent: '#ff7f00' },
  { id: 'nor', name: 'Royal Norwegian Air Force', short: 'RNoAF', eras: ['modern', 'coldwar'], lang: 'no', roundel: { kind: 'rings', rings: ['#ba0c2f', '#ffffff', '#00205b'] }, flag: NORDIC('#ba0c2f', '#ffffff', '#00205b'), helmets: { modern: MODERN_US, coldwar: COLD_WEST }, shells: ['white', 'lightgrey', 'gunship'], suits: ['sage', 'olive', 'grey'], accent: '#ba0c2f' },
  { id: 'swe', name: 'Swedish Air Force', short: 'SwAF', eras: ['modern', 'coldwar'], lang: 'sv', roundel: { kind: 'crowns', disc: '#005293', crown: '#fecb00' }, flag: NORDIC('#005293', '#fecb00'), helmets: { modern: ['typhoon', 'hgu55'], coldwar: COLD_WEST }, shells: ['white', 'lightgrey', 'navy'], suits: ['sage', 'olive', 'grey'], accent: '#fecb00' },
  { id: 'fin', name: 'Finnish Air Force', short: 'FINAF', eras: ['modern', 'coldwar'], lang: 'fi', roundel: { kind: 'rings', rings: ['#002f6c', '#ffffff', '#002f6c'] }, flag: NORDIC('#ffffff', '#002f6c'), helmets: { modern: MODERN_US, coldwar: ['aph5', 'zsh7'] }, shells: ['white', 'lightgrey', 'gunship'], suits: ['sage', 'olive', 'grey'], accent: '#002f6c' },
  { id: 'ukr', name: 'Ukrainian Air Force', short: 'UAF', eras: ['modern'], lang: 'uk', roundel: { kind: 'rings', rings: ['#0057b7', '#ffd700'] }, flag: H('#0057b7', '#ffd700'), helmets: { modern: ['zsh7', 'hgu55'], coldwar: RUSSIAN }, shells: ['white', 'lightgrey', 'olive'], suits: ['olive', 'sage', 'blue'], accent: '#ffd700' },
  { id: 'can', name: 'Royal Canadian Air Force', short: 'RCAF', eras: ['modern', 'coldwar'], lang: 'en', roundel: { kind: 'leaf', rings: ['#1f3e8f', '#ffffff'], leaf: '#d52b1e' }, flag: { kind: 'canada' }, helmets: { modern: MODERN_US, coldwar: COLD_WEST }, shells: ['white', 'lightgrey', 'gunship'], suits: ['sage', 'olive', 'grey'], accent: '#d52b1e' },
  { id: 'aus', name: 'Royal Australian Air Force', short: 'RAAF', eras: ['modern', 'coldwar'], lang: 'en', roundel: { kind: 'kangaroo', rings: ['#00247d', '#ffffff'], roo: '#e4002b' }, flag: { kind: 'australia' }, helmets: { modern: MODERN_US, coldwar: COLD_WEST }, shells: ['white', 'lightgrey', 'gunship'], suits: ['sage', 'tan', 'olive'], accent: '#e4002b' },
  { id: 'jpn', name: 'Japan Air Self-Defense Force', short: 'JASDF', eras: ['modern', 'coldwar'], lang: 'ja', roundel: { kind: 'disc', disc: '#bc002d', ring: '#ffffff' }, flag: { kind: 'japan' }, helmets: { modern: MODERN_US, coldwar: COLD_WEST }, shells: ['white', 'lightgrey', 'navy'], suits: ['sage', 'olive', 'navy'], accent: '#bc002d' },
  { id: 'twn', name: 'Republic of China Air Force', short: 'ROCAF', eras: ['modern', 'coldwar'], lang: 'zh', roundel: { kind: 'sun', disc: '#000095', sun: '#ffffff' }, flag: { kind: 'taiwan' }, helmets: { modern: MODERN_US, coldwar: COLD_WEST }, shells: ['white', 'lightgrey', 'gunship'], suits: ['sage', 'olive', 'grey'], accent: '#000095' },
  { id: 'kor', name: 'Republic of Korea Air Force', short: 'ROKAF', eras: ['modern', 'coldwar'], lang: 'ko', roundel: { kind: 'taeguk' }, flag: { kind: 'korea' }, helmets: { modern: MODERN_US, coldwar: COLD_WEST }, shells: ['white', 'lightgrey', 'gunship'], suits: ['sage', 'olive', 'grey'], accent: '#003478' },
  { id: 'isr', name: 'Israeli Air Force', short: 'IAF', eras: ['modern', 'coldwar'], lang: 'he', roundel: { kind: 'david', disc: '#ffffff', star: '#0038b8' }, flag: { kind: 'israel' }, helmets: { modern: MODERN_US, coldwar: COLD_WEST }, shells: ['white', 'tan', 'gunship'], suits: ['sage', 'tan', 'olive'], accent: '#0038b8' },
  { id: 'ind', name: 'Indian Air Force', short: 'IAF', eras: ['modern', 'coldwar'], lang: 'hi', roundel: { kind: 'rings', rings: ['#ff9933', '#ffffff', '#138808'] }, flag: { kind: 'india' }, helmets: { modern: ['zsh7', 'typhoon', 'hgu55'], coldwar: ['zsh7', 'aph5'] }, shells: ['white', 'lightgrey', 'gunship'], suits: ['sage', 'blue', 'grey'], accent: '#ff9933' },
  { id: 'rus', name: 'Russian Aerospace Forces', short: 'VKS', eras: ['modern', 'coldwar'], lang: 'ru', roundel: { kind: 'star', star: '#d52b1e', rim: '#ffffff', edge: '#0039a6' }, flag: H('#ffffff', '#0039a6', '#d52b1e'), helmets: { modern: RUSSIAN, coldwar: RUSSIAN }, shells: ['white', 'lightgrey', 'olive'], suits: ['blue', 'grey', 'olive'], accent: '#d52b1e' },
  { id: 'chn', name: "PLA Air Force", short: 'PLAAF', eras: ['modern', 'coldwar'], lang: 'zh', roundel: { kind: 'bars', star: '#de2910', bar: '#de2910', rim: '#ffde00' }, flag: { kind: 'china' }, helmets: { modern: ['typhoon', 'zsh7'], coldwar: RUSSIAN }, shells: ['white', 'lightgrey', 'navy'], suits: ['olive', 'blue', 'sage'], accent: '#de2910' },
  { id: 'usaaf', name: 'US Army Air Forces', short: 'USAAF', eras: ['ww2'], lang: 'en', roundel: { kind: 'starbar', disc: '#22336b', star: '#ffffff', bar: '#ffffff', stripe: null }, flag: { kind: 'usa' }, helmets: { ww2: ['leather'] }, shells: ['leather', 'tan'], suits: ['leather', 'tan', 'olive'], accent: '#22336b' },
  { id: 'rafww2', name: 'Royal Air Force (1940)', short: 'RAF', eras: ['ww2'], lang: 'en', roundel: { kind: 'rings', rings: ['#f2c800', '#1f3e8f', '#ffffff', '#c8102e'] }, flag: { kind: 'uk' }, helmets: { ww2: ['leather'] }, shells: ['leather', 'tan'], suits: ['leather', 'blue', 'tan'], accent: '#1f3e8f' },
  { id: 'lw', name: 'Luftwaffe (1940)', short: 'LW', eras: ['ww2'], lang: 'de', roundel: { kind: 'balken' }, flag: { kind: 'roundel' }, helmets: { ww2: ['leather'] }, shells: ['leather', 'tan'], suits: ['leather', 'grey', 'tan'], accent: '#111111' },
  { id: 'ijn', name: 'Imperial Japanese Navy Air Service', short: 'IJN', eras: ['ww2'], lang: 'ja', roundel: { kind: 'disc', disc: '#bc002d', ring: '#ffffff' }, flag: { kind: 'japan' }, helmets: { ww2: ['leather'] }, shells: ['leather', 'tan'], suits: ['leather', 'tan', 'olive'], accent: '#bc002d' },
  { id: 'vvs', name: 'Soviet Air Force (1943)', short: 'VVS', eras: ['ww2', 'coldwar'], lang: 'ru', roundel: { kind: 'star', star: '#d52b1e', rim: '#ffffff', edge: '#d52b1e' }, flag: { kind: 'roundel' }, helmets: { ww2: ['leather'], coldwar: RUSSIAN }, shells: ['leather', 'tan'], suits: ['leather', 'olive', 'blue'], accent: '#d52b1e' },
  { id: 'blue', name: 'Blue Force', short: 'BLUE', eras: ['modern', 'coldwar', 'ww2'], lang: 'en', roundel: { kind: 'chevron', disc: '#1d4fa3', mark: '#ffffff' }, flag: H('#1d4fa3', '#ffffff', '#1d4fa3'), helmets: { modern: MODERN_US, coldwar: COLD_WEST, ww2: ['leather'] }, shells: ['white', 'royal', 'gunship'], suits: ['sage', 'navy', 'grey'], accent: '#1d4fa3' },
  { id: 'red', name: 'Red Force', short: 'RED', eras: ['modern', 'coldwar', 'ww2'], lang: 'ru', roundel: { kind: 'diamond', disc: '#9e1b1b', mark: '#ffffff' }, flag: H('#9e1b1b', '#222222', '#9e1b1b'), helmets: { modern: RUSSIAN, coldwar: RUSSIAN, ww2: ['leather'] }, shells: ['white', 'red', 'lightgrey'], suits: ['blue', 'grey', 'olive'], accent: '#9e1b1b' },
];

const BY_ID = new Map(NATIONS.map((n) => [n.id, n]));

/** The nation for `id`, or Blue Force. */
export function nationById(id) {
  return BY_ID.get(id) || BY_ID.get('blue');
}

/** Nations that fly in `era` (all of them for a falsy era). */
export function nationsOfEra(era) {
  return era ? NATIONS.filter((n) => n.eras.includes(era)) : NATIONS;
}

// ---------- SVG helpers ----------

const f = (v) => (Math.round(v * 100) / 100).toString();

/** Points of a star with `n` tips around (cx, cy). */
export function starPoints(cx, cy, r, n = 5, inner = 0.382, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? r * inner : r;
    const a = rot + (i * Math.PI) / n;
    pts.push(`${f(cx + Math.cos(a) * rr)},${f(cy + Math.sin(a) * rr)}`);
  }
  return pts.join(' ');
}

const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"${extra}/>`;

function rings(cx, cy, r, colors) {
  return colors.map((c, i) => circle(cx, cy, r * (1 - i / colors.length), c)).join('');
}

/** A simple five-lobed maple leaf, unit size around (0, 0). */
const LEAF = 'M0,-1 L0.18,-0.62 L0.42,-0.74 L0.34,-0.3 L0.72,-0.42 L0.62,-0.14 L0.9,0.02 L0.52,0.24 L0.6,0.44 L0.1,0.36 L0.08,0.9 L-0.08,0.9 L-0.1,0.36 L-0.6,0.44 L-0.52,0.24 L-0.9,0.02 L-0.62,-0.14 L-0.72,-0.42 L-0.34,-0.3 L-0.42,-0.74 L-0.18,-0.62 Z';
/** A leaping kangaroo, unit size, facing left. */
const ROO = 'M-0.78,-0.32 C-0.7,-0.5 -0.5,-0.52 -0.42,-0.4 C-0.3,-0.28 -0.2,-0.36 -0.02,-0.3 C0.3,-0.2 0.48,0 0.5,0.22 C0.66,0.3 0.86,0.5 0.98,0.72 C0.8,0.62 0.62,0.5 0.46,0.42 C0.4,0.52 0.36,0.62 0.42,0.7 L0.18,0.7 C0.14,0.56 0.08,0.44 -0.04,0.36 C-0.2,0.3 -0.34,0.2 -0.36,0.04 C-0.44,0.02 -0.5,-0.08 -0.56,-0.16 C-0.64,-0.18 -0.74,-0.2 -0.78,-0.32 Z';
/** Three crowns (Swedish), each a unit crown at offsets. */
const CROWN = 'M-0.5,0.3 L-0.5,-0.2 L-0.25,0.05 L0,-0.35 L0.25,0.05 L0.5,-0.2 L0.5,0.3 Z';

const scaled = (d, cx, cy, s, fill, extra = '') => `<path d="${d}" fill="${fill}" transform="translate(${f(cx)} ${f(cy)}) scale(${f(s)})"${extra}/>`;

/** A cross pattée (flared arms), as one path around (cx, cy). */
function patteePath(cx, cy, r, waist) {
  const w = r * waist;
  const pts = [];
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const rot = (x, y) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)];
    pts.push(rot(w, -w), rot(r, -r * 0.62), rot(r, r * 0.62), rot(w, w));
  }
  return `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' L')} Z`;
}

function crossPath(cx, cy, r, t) {
  return `M${f(cx - t)},${f(cy - r)} H${f(cx + t)} V${f(cy - t)} H${f(cx + r)} V${f(cy + t)} H${f(cx + t)} V${f(cy + r)} H${f(cx - t)} V${f(cy + t)} H${f(cx - r)} V${f(cy - t)} H${f(cx - t)} Z`;
}

/** Yin-yang of the taegeuk, red over blue. */
function taeguk(cx, cy, r) {
  const top = `M${f(cx - r)},${f(cy)} A${f(r)},${f(r)} 0 0 1 ${f(cx + r)},${f(cy)} A${f(r / 2)},${f(r / 2)} 0 0 1 ${f(cx)},${f(cy)} A${f(r / 2)},${f(r / 2)} 0 0 0 ${f(cx - r)},${f(cy)} Z`;
  return `${circle(cx, cy, r, '#003478')}<path d="${top}" fill="#c60c30" transform="rotate(-30 ${f(cx)} ${f(cy)})"/>`;
}

/**
 * The nation's aircraft insignia at (cx, cy) with radius r, as SVG elements. Star-and-bar types
 * reach wider than r (their bars), the rest stay inside the circle.
 */
export function roundelSvg(nation, cx, cy, r) {
  const n = typeof nation === 'string' ? nationById(nation) : nation;
  const k = n.roundel;
  switch (k.kind) {
    case 'rings':
      return rings(cx, cy, r, k.rings);
    case 'starbar': {
      const bw = r * 1.9;
      const bh = r * 0.5;
      let out = `<rect x="${f(cx - bw)}" y="${f(cy - bh / 2)}" width="${f(bw * 2)}" height="${f(bh)}" fill="${k.bar}" stroke="${k.disc}" stroke-width="${f(r * 0.1)}"/>`;
      if (k.stripe) out += `<rect x="${f(cx - bw * 0.96)}" y="${f(cy - bh * 0.13)}" width="${f(bw * 1.92)}" height="${f(bh * 0.26)}" fill="${k.stripe}"/>`;
      out += circle(cx, cy, r, k.disc);
      out += `<polygon points="${starPoints(cx, cy, r * 0.94)}" fill="${k.star}"/>`;
      return out;
    }
    case 'pattee':
      return `<path d="${patteePath(cx, cy, r, 0.3)}" fill="#ffffff"/><path d="${patteePath(cx, cy, r * 0.8, 0.2)}" fill="#111111"/>`;
    case 'balken':
      return `<path d="${crossPath(cx, cy, r, r * 0.42)}" fill="#111111"/><path d="${crossPath(cx, cy, r * 0.88, r * 0.3)}" fill="#ffffff"/><path d="${crossPath(cx, cy, r * 0.7, r * 0.18)}" fill="#111111"/>`;
    case 'checker': {
      const s = r * 0.62;
      const b = r * 0.08;
      return `<rect x="${f(cx - s - b)}" y="${f(cy - s - b)}" width="${f((s + b) * 2)}" height="${f((s + b) * 2)}" fill="${k.a}"/>`
        + `<rect x="${f(cx - s)}" y="${f(cy - s)}" width="${f(s)}" height="${f(s)}" fill="${k.b}"/>`
        + `<rect x="${f(cx)}" y="${f(cy - s)}" width="${f(s)}" height="${f(s)}" fill="${k.a}" stroke="${k.b}" stroke-width="${f(b)}"/>`
        + `<rect x="${f(cx - s)}" y="${f(cy)}" width="${f(s)}" height="${f(s)}" fill="${k.a}" stroke="${k.b}" stroke-width="${f(b)}"/>`
        + `<rect x="${f(cx)}" y="${f(cy)}" width="${f(s)}" height="${f(s)}" fill="${k.b}"/>`;
    }
    case 'crowns':
      return circle(cx, cy, r, k.disc)
        + scaled(CROWN, cx, cy - r * 0.38, r * 0.42, k.crown)
        + scaled(CROWN, cx - r * 0.34, cy + r * 0.2, r * 0.42, k.crown)
        + scaled(CROWN, cx + r * 0.34, cy + r * 0.2, r * 0.42, k.crown);
    case 'leaf':
      return rings(cx, cy, r, k.rings) + scaled(LEAF, cx, cy, r * 0.46, k.leaf);
    case 'kangaroo':
      return rings(cx, cy, r, k.rings) + scaled(ROO, cx, cy - r * 0.04, r * 0.44, k.roo);
    case 'disc':
      return circle(cx, cy, r, k.ring) + circle(cx, cy, r * 0.84, k.disc);
    case 'sun':
      return circle(cx, cy, r, k.disc)
        + `<polygon points="${starPoints(cx, cy, r * 0.82, 12, 0.6)}" fill="${k.sun}"/>`
        + circle(cx, cy, r * 0.44, k.disc) + circle(cx, cy, r * 0.38, k.sun);
    case 'taeguk':
      return circle(cx, cy, r, '#ffffff') + taeguk(cx, cy, r * 0.72);
    case 'david': {
      const sw = f(r * 0.12);
      return circle(cx, cy, r, '#0038b8') + circle(cx, cy, r * 0.88, k.disc)
        + `<polygon points="${starPoints(cx, cy, r * 0.62, 3, 0.5)}" fill="none" stroke="${k.star}" stroke-width="${sw}"/>`
        + `<polygon points="${starPoints(cx, cy, r * 0.62, 3, 0.5, Math.PI / 2)}" fill="none" stroke="${k.star}" stroke-width="${sw}"/>`;
    }
    case 'star':
      return `<polygon points="${starPoints(cx, cy, r * 1.05)}" fill="${k.edge}"/>`
        + `<polygon points="${starPoints(cx, cy, r * 0.94)}" fill="${k.rim}"/>`
        + `<polygon points="${starPoints(cx, cy, r * 0.78)}" fill="${k.star}"/>`;
    case 'bars': {
      const bw = r * 1.7;
      const bh = r * 0.36;
      return `<rect x="${f(cx - bw)}" y="${f(cy - bh / 2)}" width="${f(bw * 2)}" height="${f(bh)}" fill="${k.bar}" stroke="${k.rim}" stroke-width="${f(r * 0.08)}"/>`
        + `<polygon points="${starPoints(cx, cy, r * 1.02)}" fill="${k.rim}"/>`
        + `<polygon points="${starPoints(cx, cy, r * 0.88)}" fill="${k.star}"/>`;
    }
    case 'chevron':
      return circle(cx, cy, r, k.disc)
        + `<path d="M${f(cx - r * 0.6)},${f(cy - r * 0.05)} L${f(cx)},${f(cy - r * 0.55)} L${f(cx + r * 0.6)},${f(cy - r * 0.05)} L${f(cx + r * 0.6)},${f(cy + r * 0.3)} L${f(cx)},${f(cy - r * 0.2)} L${f(cx - r * 0.6)},${f(cy + r * 0.3)} Z" fill="${k.mark}"/>`;
    case 'diamond':
      return circle(cx, cy, r, k.mark) + circle(cx, cy, r * 0.88, k.disc)
        + `<polygon points="${starPoints(cx, cy, r * 0.78, 4, 0.36, 0)}" fill="${k.mark}"/>`;
    default:
      return circle(cx, cy, r, '#888888');
  }
}

/**
 * The nation's flag as a w×h patch at (x, y), simplified to read at 20 px. Nations whose period
 * flag is not shown wear their roundel on a dark patch instead.
 */
export function flagSvg(nation, x, y, w, h) {
  const n = typeof nation === 'string' ? nationById(nation) : nation;
  const fl = n.flag;
  const rect = (rx, ry, rw, rh, fill) => `<rect x="${f(rx)}" y="${f(ry)}" width="${f(rw)}" height="${f(rh)}" fill="${fill}"/>`;
  const cx = x + w / 2;
  const cy = y + h / 2;
  switch (fl.kind) {
    case 'h':
      return fl.colors.map((c, i) => rect(x, y + (h * i) / fl.colors.length, w, h / fl.colors.length + 0.2, c)).join('');
    case 'v':
      return fl.colors.map((c, i) => rect(x + (w * i) / fl.colors.length, y, w / fl.colors.length + 0.2, h, c)).join('');
    case 'nordic': {
      const [field, cross, inner] = fl.colors;
      const t = h * 0.28;
      const vx = x + w * 0.32;
      let out = rect(x, y, w, h, field) + rect(x, cy - t / 2, w, t, cross) + rect(vx, y, t, h, cross);
      if (inner) out += rect(x, cy - t / 4, w, t / 2, inner) + rect(vx + t / 4, y, t / 2, h, inner);
      return out;
    }
    case 'usa': {
      let out = '';
      for (let i = 0; i < 7; i++) out += rect(x, y + (h * i) / 7, w, h / 7 + 0.2, i % 2 ? '#ffffff' : '#b22234');
      out += rect(x, y, w * 0.44, h * 0.56, '#22336b');
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) out += circle(x + w * (0.08 + i * 0.14), y + h * (0.14 + j * 0.26), h * 0.045, '#ffffff');
      return out;
    }
    case 'uk': {
      const d = `M${f(x)},${f(y)} L${f(x + w)},${f(y + h)} M${f(x + w)},${f(y)} L${f(x)},${f(y + h)}`;
      return rect(x, y, w, h, '#012169')
        + `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="${f(h * 0.24)}"/><path d="${d}" fill="none" stroke="#c8102e" stroke-width="${f(h * 0.1)}"/>`
        + rect(x, cy - h * 0.17, w, h * 0.34, '#ffffff') + rect(cx - h * 0.17, y, h * 0.34, h, '#ffffff')
        + rect(x, cy - h * 0.1, w, h * 0.2, '#c8102e') + rect(cx - h * 0.1, y, h * 0.2, h, '#c8102e');
    }
    case 'canada':
      return rect(x, y, w, h, '#ffffff') + rect(x, y, w * 0.25, h, '#d52b1e') + rect(x + w * 0.75, y, w * 0.25, h, '#d52b1e') + scaled(LEAF, cx, cy, h * 0.36, '#d52b1e');
    case 'australia':
      return rect(x, y, w, h, '#00247d') + flagSvg({ flag: { kind: 'uk' } }, x, y, w * 0.5, h * 0.5)
        + `<polygon points="${starPoints(x + w * 0.25, y + h * 0.76, h * 0.13, 7, 0.5)}" fill="#ffffff"/>`
        + `<polygon points="${starPoints(x + w * 0.76, y + h * 0.3, h * 0.08, 7, 0.5)}" fill="#ffffff"/>`
        + `<polygon points="${starPoints(x + w * 0.66, y + h * 0.6, h * 0.08, 7, 0.5)}" fill="#ffffff"/>`
        + `<polygon points="${starPoints(x + w * 0.86, y + h * 0.66, h * 0.08, 7, 0.5)}" fill="#ffffff"/>`;
    case 'japan':
      return rect(x, y, w, h, '#ffffff') + circle(cx, cy, h * 0.3, '#bc002d');
    case 'taiwan':
      return rect(x, y, w, h, '#fe0000') + rect(x, y, w * 0.5, h * 0.5, '#000095')
        + `<polygon points="${starPoints(x + w * 0.25, y + h * 0.25, h * 0.18, 12, 0.6)}" fill="#ffffff"/>` + circle(x + w * 0.25, y + h * 0.25, h * 0.08, '#ffffff');
    case 'korea':
      return rect(x, y, w, h, '#ffffff') + taeguk(cx, cy, h * 0.26)
        + [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => `<path d="M${f(cx + sx * w * 0.3)},${f(cy + sy * h * 0.32)} l${f(sx * w * 0.08)},${f(-sy * h * 0.08)}" stroke="#000000" stroke-width="${f(h * 0.1)}"/>`).join('');
    case 'israel':
      return rect(x, y, w, h, '#ffffff') + rect(x, y + h * 0.12, w, h * 0.14, '#0038b8') + rect(x, y + h * 0.74, w, h * 0.14, '#0038b8')
        + `<polygon points="${starPoints(cx, cy, h * 0.2, 3, 0.5)}" fill="none" stroke="#0038b8" stroke-width="${f(h * 0.05)}"/>`
        + `<polygon points="${starPoints(cx, cy, h * 0.2, 3, 0.5, Math.PI / 2)}" fill="none" stroke="#0038b8" stroke-width="${f(h * 0.05)}"/>`;
    case 'india':
      return flagSvg({ flag: H('#ff9933', '#ffffff', '#138808') }, x, y, w, h) + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(h * 0.12)}" fill="none" stroke="#000080" stroke-width="${f(h * 0.04)}"/>`;
    case 'china':
      return rect(x, y, w, h, '#de2910') + `<polygon points="${starPoints(x + w * 0.17, y + h * 0.27, h * 0.16)}" fill="#ffde00"/>`
        + [[0.34, 0.12], [0.4, 0.24], [0.4, 0.4], [0.34, 0.52]].map(([px, py]) => `<polygon points="${starPoints(x + w * px, y + h * py, h * 0.055)}" fill="#ffde00"/>`).join('');
    default:
      return rect(x, y, w, h, '#2b2d30') + roundelSvg(n, cx, cy, h * 0.36);
  }
}
