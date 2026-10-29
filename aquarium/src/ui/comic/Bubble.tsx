import { useEffect, useState } from 'preact/hooks';
import { sfx } from '../../audio/sfx';
import { reducedMotion } from '../theme';

/** Text that types itself out. `done` reports when it has finished (or was skipped). */
export function useTyping(text: string, skip: boolean, onDone: () => void) {
  const [n, setN] = useState(reducedMotion() ? text.length : 0);
  useEffect(() => setN(reducedMotion() ? text.length : 0), [text]);
  useEffect(() => {
    if (skip) setN(text.length);
  }, [skip, text]);
  useEffect(() => {
    if (n >= text.length) {
      onDone();
      return;
    }
    const t = setTimeout(() => {
      setN((x) => Math.min(text.length, x + 2));
      if (n % 6 === 0) sfx.type();
    }, 34);
    return () => clearTimeout(t);
  }, [n, text]);
  return text.slice(0, n);
}

export function Bubble({
  name,
  color,
  text,
  skip,
  onDone,
  onClose,
}: {
  name: string;
  color: string;
  text: string;
  skip: boolean;
  onDone: () => void;
  onClose?: () => void;
}) {
  const shown = useTyping(text, skip, onDone);
  const typing = shown.length < text.length;
  return (
    <div class="bubble" style={{ '--who-dark': shade(color) }}>
      {onClose && (
        <button
          type="button"
          class="bubble-close"
          aria-label="Dismiss"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          ×
        </button>
      )}
      <span class="who">{name}</span>
      <span aria-hidden="true">{shown}</span>
      {typing && <span class="caret" aria-hidden="true" />}
      <span class="sr">{text}</span>
    </div>
  );
}

/** A darker version of a cast colour, readable on the ink bubble. */
function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const k = 0.45;
  return `rgb(${((n >> 16) & 255) * k},${((n >> 8) & 255) * k},${(n & 255) * k})`;
}
