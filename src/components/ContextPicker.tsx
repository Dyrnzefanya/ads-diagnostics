'use client';

import { LEVELS, OBJECTIVES, PATHS, PATH_LIST } from '@/config/meta/paths';
import type { Level } from '@/engine/types';

interface Props {
  pathId: string;
  level: Level;
  onPath: (id: string) => void;
  onLevel: (l: Level) => void;
}

const pill = (on: boolean) =>
  `rounded-full border px-3.5 py-2 text-sm transition-colors ${
    on ? 'border-teal bg-teal/15 text-teal' : 'border-line text-dim hover:border-dim hover:text-fg'
  }`;

export function ContextPicker({ pathId, level, onPath, onLevel }: Props) {
  const cfg = PATHS[pathId];
  const paths = PATH_LIST.filter((p) => p.objective === cfg.objective);
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">1. Objective kampanye</legend>
        <div className="flex flex-wrap gap-2">
          {OBJECTIVES.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={cfg.objective === o.id}
              className={pill(cfg.objective === o.id)}
              onClick={() => onPath(PATH_LIST.find((p) => p.objective === o.id)!.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">2. Hasil yang dikejar</legend>
        <div className="flex flex-wrap gap-2">
          {paths.map((p) => (
            <button key={p.id} type="button" aria-pressed={pathId === p.id} className={pill(pathId === p.id)} onClick={() => onPath(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">3. Level yang dibaca</legend>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button key={l.id} type="button" aria-pressed={level === l.id} className={pill(level === l.id)} onClick={() => onLevel(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
