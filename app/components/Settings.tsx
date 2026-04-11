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
        <p className="text-xs text-muted mt-1">
          Опишите одежду на английском — помогает AI точнее передать детали. Чем подробнее, тем лучше.
        </p>
      </div>

      {/* Toggle advanced */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-2 text-xs text-muted hover:text-foreground flex items-center gap-1 border-t border-border transition-colors"
      >
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>&#9654;</span>
        Расширенные настройки
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Category */}
          <div>
            <label className="block text-xs text-muted mb-1.5 font-medium">Категория</label>
            <select
              value={settings.category}
              onChange={(e) => update({ category: e.target.value as TryOnSettings["category"] })}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            >
              <option value="full_outfit">Полный костюм (верх + низ)</option>
              <option value="upper_body">Только верх (футболки, блузки, куртки)</option>
              <option value="lower_body">Только низ (юбки, брюки, шорты)</option>
              <option value="dresses">Платья / комбинезоны</option>
            </select>
            <p className="text-xs text-muted mt-1">
              «Полный костюм» — AI сначала оденет верх, потом низ (два прохода, дольше, но точнее).
              Для отдельных вещей выберите «Только верх» или «Только низ».
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Steps */}
            <div>
              <label className="block text-xs text-muted mb-1.5 font-medium">
                Шаги: {settings.steps}
              </label>
              <input
                type="range"
                min={10}
                max={40}
                value={settings.steps}
                onChange={(e) => update({ steps: Number(e.target.value) })}
                className="w-full accent-accent"
              />
              <p className="text-xs text-muted mt-1">
                Больше шагов = лучше качество, но дольше. 30 — оптимально, 20 — быстрый тест.
              </p>
            </div>

            {/* Seed */}
            <div>
              <label className="block text-xs text-muted mb-1.5 font-medium">Seed</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={settings.seed ?? ""}
                  onChange={(e) =>
                    update({ seed: e.target.value ? Number(e.target.value) : null })
                  }
                  placeholder="случайный"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
                <button
                  onClick={() => update({ seed: null })}
                  className="px-3 py-2 bg-background border border-border rounded-lg text-xs hover:border-accent transition-colors"
                >
                  Rand
                </button>
              </div>
              <p className="text-xs text-muted mt-1">
                Одинаковый seed = одинаковый результат. Пустое поле = каждый раз новый вариант.
              </p>
            </div>
          </div>

          {/* Crop */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={settings.crop}
              onChange={(e) => update({ crop: e.target.checked })}
              className="mt-0.5 accent-accent"
              id="crop-toggle"
            />
            <label htmlFor="crop-toggle" className="text-sm cursor-pointer">
              <span className="font-medium">Автообрезка</span>
              <p className="text-xs text-muted mt-0.5">
                Автоматически обрезает фото модели до пропорции 3:4. Включите, если фото не в портретном формате.
              </p>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
