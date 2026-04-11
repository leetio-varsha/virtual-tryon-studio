"use client";

import { useRef, useState } from "react";
import type { TryOnSettings, AiModel } from "@/lib/db/schema";

interface SettingsProps {
  settings: TryOnSettings;
  onChange: (settings: TryOnSettings) => void;
}

export default function Settings({ settings, onChange }: SettingsProps) {
  const [open, setOpen] = useState(false);
  const [uploadingFace, setUploadingFace] = useState(false);
  const faceInputRef = useRef<HTMLInputElement>(null);

  const update = (partial: Partial<TryOnSettings>) => {
    onChange({ ...settings, ...partial });
  };

  const uploadFace = async (file: File) => {
    setUploadingFace(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.paths?.[0]) {
        update({ faceImagePath: data.paths[0] });
      }
    } catch (e) {
      console.error("Face upload failed:", e);
    } finally {
      setUploadingFace(false);
    }
  };

  return (
    <div className="rounded-xl bg-surface border border-border">
      {/* AI Model + Prompts — always visible */}
      <div className="p-4 space-y-4">
        {/* AI Model selector */}
        <div>
          <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">
            AI Модель
          </label>
          <div className="flex gap-2">
            {([
              { value: "fashn-v1.6" as AiModel, label: "FASHN v1.6", desc: "Лучшие детали" },
              { value: "leffa" as AiModel, label: "Leffa", desc: "CVPR 2025" },
              { value: "idm-vton" as AiModel, label: "IDM-VTON", desc: "Базовая" },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => update({ aiModel: opt.value })}
                className={`
                  flex-1 py-2 rounded-lg text-sm font-medium transition-colors border
                  ${settings.aiModel === opt.value
                    ? "bg-accent text-white border-accent"
                    : "bg-background border-border hover:border-accent/50"}
                `}
              >
                <div>{opt.label}</div>
                <div className="text-xs opacity-70">{opt.desc}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mt-1">
            FASHN — лучше передаёт логотипы и швы. Leffa — новейшая от Meta. IDM-VTON — быстрая и дешёвая.
          </p>
        </div>

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

        {/* Face swap — always visible (critical for quality) */}
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={settings.faceSwap}
              onChange={(e) => update({ faceSwap: e.target.checked })}
              className="mt-0.5 accent-accent"
              id="face-swap-toggle"
            />
            <label htmlFor="face-swap-toggle" className="flex-1 text-sm cursor-pointer">
              <span className="font-medium">Замена лица</span>
              <p className="text-xs text-muted mt-0.5">
                Подменит лицо модели на твоё референсное фото. Держит лицо одинаковым
                во всех генерациях — иначе AI каждый раз рисует разные лица.
              </p>
            </label>
          </div>

          {settings.faceSwap && (
            <div className="mt-3 flex items-center gap-3">
              {settings.faceImagePath ? (
                <>
                  <img
                    src={settings.faceImagePath}
                    alt="Face reference"
                    className="w-16 h-16 rounded-lg object-cover border border-border"
                  />
                  <div className="flex-1">
                    <p className="text-xs text-muted mb-1">Референсное фото лица загружено</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => faceInputRef.current?.click()}
                        className="text-xs px-3 py-1.5 bg-surface border border-border rounded-lg hover:border-accent transition-colors"
                      >
                        Заменить
                      </button>
                      <button
                        onClick={() => update({ faceImagePath: null })}
                        className="text-xs px-3 py-1.5 bg-surface border border-border rounded-lg hover:border-red-500 transition-colors"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => faceInputRef.current?.click()}
                  disabled={uploadingFace}
                  className="w-full py-3 border-2 border-dashed border-border rounded-lg text-sm text-muted hover:border-accent hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {uploadingFace ? "Загрузка..." : "Загрузить фото лица (чёткое, анфас)"}
                </button>
              )}
              <input
                ref={faceInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFace(file);
                  e.target.value = "";
                }}
              />
            </div>
          )}
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
              «Полный костюм» — загрузите 2 фото одежды: 1-е = верх, 2-е = низ. AI оденет в два прохода.
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
