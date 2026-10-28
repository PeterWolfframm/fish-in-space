// A plain-text dump of swipe records, shared by the CLI export and the Admin download.
// Optional lines (seed, notes, scores, …) appear only when that swipe has them.

const score = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : null);

/**
 * One block per swipe, separated by a blank line, with a trailing newline when non-empty.
 * `nameOf(userId)` supplies a display name; otherwise the user id is printed.
 * Order is the caller's: the CLI passes oldest-first, Admin passes its filtered list.
 */
export function swipesToTxt(swipes, { nameOf } = {}) {
  const label = (id) => {
    const named = nameOf?.(id);
    return named == null || named === '' ? (id ?? '') : named;
  };
  const blocks = swipes.map((s) => {
    const lines = [
      `--- swipe ${s.created ?? ''} ---`,
      `user: ${label(s.user)}`,
      `kind: ${s.kind ?? ''}  code: ${s.code ?? ''}  verdict: ${s.verdict ?? ''}`,
    ];
    if (s.seed) lines.push(`seed: ${s.seed}`);
    if (s.fix?.length) lines.push(`fix: ${s.fix.join(', ')}`);
    if (s.instead && Object.keys(s.instead).length) lines.push(`instead: ${JSON.stringify(s.instead)}`);
    if (s.asKind) lines.push(`asKind: ${s.asKind}`);
    if (s.note) lines.push(`note: ${String(s.note).replace(/\r?\n/g, ' ')}`);
    const bits = [];
    const pub = score(s.scores?.public);
    const personal = score(s.scores?.personal);
    if (pub != null) bits.push(`public=${pub}`);
    if (personal != null) bits.push(`personal=${personal}`);
    if (s.mode) bits.push(`mode: ${s.mode}`);
    if (bits.length) lines.push(`scores: ${bits.join(' ')}`);
    return lines.join('\n');
  });
  return blocks.length ? `${blocks.join('\n\n')}\n` : '';
}
