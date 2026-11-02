// A generic editor for any generator's traits.fields — the trait system every generator exposes
// (forge/pixel/traits.d.ts). Gated fields (`when`) hide instead of disabling, same as the game's
// own breeding UI reads them.

interface TraitChoice {
  id: string;
  label?: string;
}
interface TraitField {
  id: string;
  label?: string;
  group?: string;
  choices: TraitChoice[];
  when?: (set: Record<string, string>) => boolean;
}
interface TraitSystem {
  fields: TraitField[];
  normalize: (raw: unknown) => Record<string, string>;
}

export function TraitForm({
  traits,
  set,
  onChange,
}: {
  traits: TraitSystem;
  set: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  return (
    <div class="studio-traits">
      {traits.fields
        .filter((f) => !f.when || f.when(set))
        .map((f) => (
          <label class="studio-field" key={f.id}>
            <span>{f.label ?? f.id}</span>
            <select
              value={set[f.id] ?? ''}
              onChange={(e) => onChange(traits.normalize({ ...set, [f.id]: (e.currentTarget as HTMLSelectElement).value }))}
            >
              {f.choices.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.label ?? c.id}
                </option>
              ))}
            </select>
          </label>
        ))}
    </div>
  );
}
