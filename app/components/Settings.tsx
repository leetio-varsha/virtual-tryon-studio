"use client";

import { useState } from "react";
import type { TryOnSettings } from "@/lib/db/schema";

interface SettingsProps {
  settings: TryOnSettings;
  onChange: (settings: TryOnSettings) => void;
}

export default function Settings({ settings, onChange }: SettingsProps) {
  const [open, setOpen] = useState(false);

  const update = (partial: Partial<TryOnSettings>) => {
    onChange({ ...settings, ...partial });
  };

  return (
    <div className="rounded-xl bg-surface border border-border">
      {/* Prompt — always visible */}
      <div className="p-4">
        <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">
          Описание одежды (промпт)
        </label>
        <input
          type="text"
          value={settings.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          placeholder="например: white cotton t-shirt with logo"
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
        />
      </div>

      {/* Toggle advanced */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2 text-xs text-muted hover:text-foreground flex items-center gap-1 border-t border-border transition-colors"
      >
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        Расширенные настройки
      </button>

      {open && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-4">
          {/* Category */}
          <div>
            <label className="block text-xs text-muted mb-1.5">Категория</label>
            <select
              value={settings.category}
              onChange={(e) => update({ category: e.target.value as TryOnSettings["category"] })}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            >
              <option value="upper_body">Верх</option>
              <option value="lower_body">Низ</option>
              <option value="dresses">Платья</option>
            </select>
          </div>

          {/* Steps */}
          <div>
            <label className="block text-xs text-muted mb-1.5">
              Шаги: {settings.steps}
            </label>
            <input
              type="range"
              min={20}
              max={50}
              value={settings.steps}
              onChange={(e) => update({ steps: Number(e.target.value) })}
              className="w-full accent-accent"
            />
          </div>

          {/* Guidance Scale */}
          <div>
            <label className="block text-xs text-muted mb-1.5">
              Guidance: {settings.guidanceScale.toFixed(1)}
            </label>
            <input
              type="range"
              min={1}
              max={5}
              step={0.1}
              value={settings.guidanceScale}
              onChange={(e) => update({ guidanceScale: Number(e.target.value) })}
              className="w-full accent-accent"
            />
          </div>

          {/* Seed */}
          <div>
            <label className="block text-xs text-muted mb-1.5">Seed</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={settings.seed ?? ""}
                onChange={(e) =>
                  update({ seed: e.target.value ? Number(e.target.value) : null })
                }
                placeholder="random"
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
              <button
                onClick={() => update({ seed: null })}
                className="px-3 py-2 bg-background border border-border rounded-lg text-xs hover:border-accent transition-colors"
              >
                Rand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
