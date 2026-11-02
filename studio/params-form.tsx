// A schema-driven form for a generator's optional `params` capability (fish4's PARAM_SCHEMA,
// forge/v4/fish/schema.js). Scalar types get a real control; the structured ones (map, list,
// tuple, choiceWeights, rules) get a JSON textarea — honest about the fidelity, since a bespoke
// widget per shape is a lot of surface for one generator's knobs.

import { useState } from 'preact/hooks';

interface ParamSchemaEntry {
  path: string;
  type: string;
  label?: string;
  group?: string;
  min?: number;
  max?: number;
  choices?: string[];
  nullable?: boolean;
  reserved?: boolean;
  note?: string;
}
interface ParamGroup {
  id: string;
  label: string;
}
export interface ParamsCapability {
  schema: ParamSchemaEntry[];
  groups?: ParamGroup[];
  validate: (p: unknown) => { ok: boolean; errors: { path: string; message: string }[]; warnings: { path: string; message: string }[] };
  set: (p: unknown, path: string, value: unknown) => unknown;
  resolve: (p?: unknown) => Record<string, unknown>;
}

const getPath = (o: unknown, path: string) => path.split('.').reduce<any>((v, k) => (v == null ? undefined : v[k]), o);

function JsonControl({ value, onSet }: { value: unknown; onSet: (v: unknown) => void }) {
  const [text, setText] = useState(JSON.stringify(value ?? null));
  const [bad, setBad] = useState(false);
  return (
    <textarea
      class={bad ? 'studio-json bad' : 'studio-json'}
      rows={2}
      value={text}
      onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
      onBlur={() => {
        try {
          onSet(JSON.parse(text));
          setBad(false);
        } catch {
          setBad(true);
        }
      }}
    />
  );
}

function ScalarControl({ s, value, onSet }: { s: ParamSchemaEntry; value: unknown; onSet: (v: unknown) => void }) {
  switch (s.type) {
    case 'bool':
      return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onSet((e.currentTarget as HTMLInputElement).checked)} />;
    case 'enum':
      return (
        <select value={String(value ?? '')} onChange={(e) => onSet((e.currentTarget as HTMLSelectElement).value)}>
          {(s.choices ?? []).map((c) => (
            <option value={c} key={c}>
              {c}
            </option>
          ))}
        </select>
      );
    case 'string':
      return <input type="text" value={String(value ?? '')} onChange={(e) => onSet((e.currentTarget as HTMLInputElement).value)} />;
    case 'number':
    case 'int':
      return (
        <input
          type="number"
          step={s.type === 'int' ? 1 : 'any'}
          min={s.min}
          max={s.max}
          value={value == null ? '' : String(value)}
          onChange={(e) => {
            const raw = (e.currentTarget as HTMLInputElement).value;
            if (raw === '' && s.nullable) return onSet(null);
            onSet(s.type === 'int' ? parseInt(raw, 10) : parseFloat(raw));
          }}
        />
      );
    default:
      return <JsonControl value={value} onSet={onSet} />;
  }
}

export function ParamsForm({ cap, params, onChange }: { cap: ParamsCapability; params: unknown; onChange: (next: unknown) => void }) {
  const resolved = cap.resolve(params ?? undefined);
  const check = cap.validate(params ?? {});
  const groups = cap.groups ?? [{ id: '', label: 'Params' }];
  return (
    <div class="studio-params">
      {check.errors.length > 0 && (
        <ul class="studio-params-errors">
          {check.errors.map((e, i) => (
            <li key={i}>
              {e.path}: {e.message}
            </li>
          ))}
        </ul>
      )}
      {groups.map((g) => (
        <details class="studio-params-group" key={g.id} open={g.id === 'algorithm'}>
          <summary>{g.label}</summary>
          {cap.schema
            .filter((s) => (s.group ?? '') === g.id && !s.reserved)
            .map((s) => (
              <label class="studio-field" key={s.path} title={s.note}>
                <span>{s.label ?? s.path}</span>
                <ScalarControl s={s} value={getPath(resolved, s.path)} onSet={(v) => onChange(cap.set(params ?? {}, s.path, v))} />
              </label>
            ))}
        </details>
      ))}
    </div>
  );
}
