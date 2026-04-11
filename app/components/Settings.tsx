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
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "hybrid-fashn-flux" as AiModel, label: "Гибрид", desc: "FASHN + FLUX.2" },
              { value: "flux-photoshoot" as AiModel, label: "Фотошут", desc: "FLUX.2 — быстрый" },
              { value: "fashn-v1.6" as AiModel, label: "FASHN v1.6", desc: "Точные детали" },
              { value: "leffa" as AiModel, label: "Leffa", desc: "CVPR 2025" },
              { value: "idm-vton" as AiModel, label: "IDM-VTON", desc: "Базовая" },
            ]).map((opt, i) => (
              <button
                key={opt.value}
                onClick={() => update({ aiModel: opt.value })}
                className={`
                  py-2 rounded-lg text-sm font-medium transition-colors border
                  ${i === 0 ? "col-span-2" : ""}
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
            {settings.aiModel === "hybrid-fashn-flux"
              ? "Гибрид — FASHN точно копирует одежду (швы, логотипы, текстура), затем FLUX.2 создаёт реалистичную сцену. Лучшее качество, но дольше."
              : settings.aiModel === "flux-photoshoot"
              ? "FLUX.2 Pro — генерирует полный фотошут: модель + одежда + сцена в одном кадре. Быстро, но может менять детали одежды."
              : "FASHN — точные логотипы и швы. Leffa — Meta CVPR 2025. IDM-VTON — быстрая и дешёвая."}
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
            {settings.aiModel === "flux-photoshoot" || settings.aiModel === "hybrid-fashn-flux"
              ? "Обязательно. Опишите где происходит съёмка: кафе в Париже, фитнес-зал, улица Дубая..."
              : "Опишите желаемый фон на английском. Оставьте пустым — фон останется оригинальный."}
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
          {/* Category — not needed for flux-photoshoot (but needed for hybrid) */}
          {settings.aiModel !== "flux-photoshoot" && (
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
          )}

          {/* ── FASHN-specific settings (also used by hybrid) ── */}
          {(settings.aiModel === "fashn-v1.6" || settings.aiModel === "hybrid-fashn-flux") && (
            <>
              <div>
                <label className="block text-xs text-muted mb-1.5 font-medium">Режим генерации</label>
                <div className="flex gap-2">
                  {([
                    { value: "performance" as const, label: "Быстрый" },
                    { value: "balanced" as const, label: "Баланс" },
                    { value: "quality" as const, label: "Качество" },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => update({ fashnMode: opt.value })}
                      className={`
                        flex-1 py-2 rounded-lg text-sm font-medium transition-colors border
                        ${settings.fashnMode === opt.value
                          ? "bg-accent text-white border-accent"
                          : "bg-background border-border hover:border-accent/50"}
                      `}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted mt-1">
                  Как тщательно AI будет рисовать одежду на модели.
                  «Быстрый» — экономит время, но может потерять мелкие детали.
                  «Качество» — дольше, зато лучше передаёт швы, логотипы и текстуру ткани.
                </p>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5 font-medium">Тип фото одежды</label>
                <div className="flex gap-2">
                  {([
                    { value: "auto" as const, label: "Авто" },
                    { value: "flat-lay" as const, label: "Раскладка" },
                    { value: "model" as const, label: "На модели" },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => update({ garmentPhotoType: opt.value })}
                      className={`
                        flex-1 py-2 rounded-lg text-sm font-medium transition-colors border
                        ${settings.garmentPhotoType === opt.value
                          ? "bg-accent text-white border-accent"
                          : "bg-background border-border hover:border-accent/50"}
                      `}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted mt-1">
                  Расскажите AI, как сфотографирована одежда.
                  «Раскладка» — одежда лежит на плоской поверхности (стол, пол).
                  «На модели» — одежда уже надета на человека на фото-референсе.
                  «Авто» — AI сам попробует определить, но может ошибиться.
                </p>
              </div>
            </>
          )}

          {/* ── Leffa-specific settings ── */}
          {settings.aiModel === "leffa" && (
            <>
              <div>
                <label className="block text-xs text-muted mb-1.5 font-medium">
                  Шаги: {settings.steps}
                </label>
                <input
                  type="range"
                  min={10}
                  max={50}
                  value={settings.steps}
                  onChange={(e) => update({ steps: Number(e.target.value) })}
                  className="w-full accent-accent"
                />
                <p className="text-xs text-muted mt-1">
                  Сколько раз AI перерисовывает картинку, улучшая её с каждым шагом.
                  Мало шагов (10-20) — быстро, но одежда может выглядеть размыто.
                  Много шагов (40-50) — дольше, зато чётче швы, пуговицы и складки.
                </p>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5 font-medium">
                  Точность: {settings.guidanceScale.toFixed(1)}
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.5}
                  value={settings.guidanceScale}
                  onChange={(e) => update({ guidanceScale: Number(e.target.value) })}
                  className="w-full accent-accent"
                />
                <p className="text-xs text-muted mt-1">
                  Насколько строго AI копирует оригинальную одежду.
                  Низкое значение (1-2) — AI рисует свободнее, может менять детали.
                  Высокое (4-7) — AI точнее повторяет цвет, узор и форму, но картинка может стать менее естественной.
                  Рекомендуем 2.5-4.0.
                </p>
              </div>
            </>
          )}

          {/* ── IDM-VTON-specific settings ── */}
          {settings.aiModel === "idm-vton" && (
            <>
              <div>
                <label className="block text-xs text-muted mb-1.5 font-medium">Описание одежды</label>
                <input
                  type="text"
                  value={settings.prompt}
                  onChange={(e) => update({ prompt: e.target.value })}
                  placeholder="например: long sleeve zip-up athletic top with SX logo"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
                <p className="text-xs text-muted mt-1">
                  Текстовая подсказка для AI — опишите одежду на английском.
                  IDM-VTON использует это описание чтобы лучше понять что за вещь на фото.
                  Другие модели (FASHN, Leffa) работают только по фото и текст не читают.
                </p>
              </div>

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
                  Сколько раз AI перерисовывает картинку, улучшая её с каждым шагом.
                  Мало (10-15) — быстро, но грубовато. Много (30-40) — дольше, но детальнее.
                  30 — золотая середина.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={settings.crop}
                  onChange={(e) => update({ crop: e.target.checked })}
                  className="mt-0.5 accent-accent"
                  id="crop-toggle"
                />
                <label htmlFor="crop-toggle" className="text-sm cursor-pointer">
                  <span className="font-medium">Автообрезка модели</span>
                  <p className="text-xs text-muted mt-0.5">
                    Обрезает фото модели до пропорций 3:4 перед обработкой.
                    Включите, если на фото модель стоит далеко или фото горизонтальное —
                    AI лучше работает с портретным кадрированием.
                  </p>
                </label>
              </div>
            </>
          )}

          {/* ── Common settings (all models) ── */}
          <div className="border-t border-border pt-4 mt-4">
            <p className="text-xs text-muted mb-3 uppercase tracking-wider">Общие</p>

            <div className="space-y-4">
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
                  Это как «номер рецепта» для AI. Если вставить одно и то же число —
                  AI нарисует точно такой же результат. Полезно когда нашли хороший вариант
                  и хотите повторить. Пустое поле = каждый раз новый случайный результат.
                </p>
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
                    После генерации AI увеличивает картинку в 2 раза и улучшает лицо.
                    Результат выглядит как профессиональная фотография — чёткие поры кожи,
                    ресницы, текстура ткани. Добавляет ~10-15 секунд к генерации.
                  </p>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
