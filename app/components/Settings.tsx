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
      {/* Prompts — always visible */}
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">
            Описание одежды
          </label>
          <input
            type="text"
            value={settings.prompt}
            onChange={(e) => update({ prompt: e.target.value })}
            placeholder="например: long sleeve high neck zip-up athletic top with SX logo"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
          <p className="text-xs text-muted mt-1">
            Опишите одежду на английском — помогает AI точнее передать детали.
          </p>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">
            Сцена / Фон
          </label>
          <input
            type="text"
            value={settings.scenePrompt}
            onChange={(e) => update({ scenePrompt: e.target.value })}
            placeholder="например: modern gym interior, soft lighting, clean background"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
          <p className="text-xs text-muted mt-1">
            Опишите желаемый фон на английском. Оставьте пустым — фон останется оригинальный.
          </p>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">
            Финальный промпт
          </label>
          <textarea
            value={settings.finalPrompt}
            onChange={(e) => update({ finalPrompt: e.target.value })}
            placeholder={"например: professional fashion photoshoot, model posing confidently,\nsoft natural lighting, high-end Instagram aesthetic, sharp details, 4K"}
            rows={2}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent resize-y"
          />
          <p className="text-xs text-muted mt-1">
            Опишите как должно выглядеть итоговое фото: стиль, освещение, настроение, качество.
            Работает вместе с фоном. Оставьте пустым — фото останется как есть.
          </p>
        </div>

        {/* Aspect ratio — always visible */}
        <div>
          <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">
            Формат для Instagram
          </label>
          <div className="flex gap-2">
            {([
              { value: "4:5", label: "4:5", desc: "Лента" },
              { value: "1:1", label: "1:1", desc: "Квадрат" },
              { value: "9:16", label: "9:16", desc: "Сторис / Reels" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => update({ aspectRatio: opt.value })}
                className={`
                  flex-1 py-2 rounded-lg text-sm font-medium transition-colors border
                  ${settings.aspectRatio === opt.value
                    ? "bg-accent text-white border-accent"
                    : "bg-background border-border hover:border-accent/50"}
                `}
              >
                <div>{opt.label}</div>
                <div className="text-xs opacity-70">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
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
                Больше = лучше качество, но дольше. 30 — оптимально.
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
                Одинаковый seed = одинаковый результат. Пустое = каждый раз новый.
              </p>
            </div>
          </div>

          {/* HD Upscale */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={settings.hdUpscale}
              onChange={(e) => update({ hdUpscale: e.target.checked })}
              className="mt-0.5 accent-accent"
              id="hd-toggle"
            />
            <label htmlFor="hd-toggle" className="text-sm cursor-pointer">
              <span className="font-medium">HD качество</span>
              <p className="text-xs text-muted mt-0.5">
                Увеличивает разрешение в 2x и улучшает лицо. Результат как с профессиональной фотосессии. +10-15 сек.
              </p>
            </label>
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
                Обрезает фото модели до 3:4. Включите если фото не портретное.
              </p>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
