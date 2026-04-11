"use client";

import { useState, useCallback } from "react";
import ImageDropZone from "./components/ImageDropZone";
import Settings from "./components/Settings";
import ResultPanel from "./components/ResultPanel";
import TemplateManager from "./components/TemplateManager";
import type { TryOnSettings } from "@/lib/db/schema";

const DEFAULT_SETTINGS: TryOnSettings = {
  aiModel: "fashn-v1.6",
  category: "full_outfit",
  steps: 30,
  seed: null,
  prompt: "",
  crop: true,
  scenePrompt: "",
  finalPrompt: "",
  aspectRatio: "4:5",
  hdUpscale: true,
  faceSwap: false,
  faceImagePath: null,
  fashnMode: "quality",
  garmentPhotoType: "auto",
  guidanceScale: 2.5,
};

export default function Home() {
  const [modelImages, setModelImages] = useState<string[]>([]);
  const [garmentImages, setGarmentImages] = useState<string[]>([]);
  const [selectedGarment, setSelectedGarment] = useState(0);
  const [settings, setSettings] = useState<TryOnSettings>(DEFAULT_SETTINGS);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const isFullOutfit = settings.category === "full_outfit";
  const canGenerate =
    modelImages.length > 0 &&
    garmentImages.length > 0 &&
    (!isFullOutfit || garmentImages.length >= 2) &&
    !loading;

  const generate = useCallback(async () => {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelImage: modelImages[0],
          garmentImage: isFullOutfit ? garmentImages[0] : garmentImages[selectedGarment],
          ...(isFullOutfit && { garmentImageBottom: garmentImages[1] }),
          settings,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setResultUrl(data.resultUrl);
      setHistory((prev) => [data.resultUrl, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка генерации");
    } finally {
      setLoading(false);
    }
  }, [canGenerate, modelImages, garmentImages, selectedGarment, settings]);

  const loadTemplate = (data: {
    modelImage: string;
    garmentImages: string[];
    settings: TryOnSettings;
  }) => {
    setModelImages([data.modelImage]);
    setGarmentImages(data.garmentImages);
    setSelectedGarment(0);
    setSettings(data.settings);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold">Stim Try-On</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTemplatesOpen(true)}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-sm hover:border-accent transition-colors"
          >
            Шаблоны
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Two-panel layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[400px]">
            {/* Left: Model */}
            <div className="rounded-xl bg-surface border border-border p-4">
              <ImageDropZone
                label="Модель"
                images={modelImages}
                onImagesChange={setModelImages}
              />
            </div>

            {/* Right: Garments */}
            <div className="rounded-xl bg-surface border border-border p-4">
              <ImageDropZone
                label={isFullOutfit ? "Одежда (1-е = верх, 2-е = низ)" : "Одежда (референсы)"}
                multiple
                images={garmentImages}
                selectedIndex={isFullOutfit ? undefined : selectedGarment}
                onImagesChange={setGarmentImages}
                onSelect={isFullOutfit ? undefined : setSelectedGarment}
                slotLabels={isFullOutfit ? { 0: "Верх", 1: "Низ" } : undefined}
              />
            </div>
          </div>

          {/* Settings + Generate */}
          <Settings settings={settings} onChange={setSettings} />

          <button
            onClick={generate}
            disabled={!canGenerate}
            className={`
              w-full py-3 rounded-xl text-sm font-semibold transition-colors
              ${canGenerate
                ? "bg-accent hover:bg-accent-hover text-white"
                : "bg-surface text-muted cursor-not-allowed border border-border"}
            `}
          >
            {loading ? "Генерация..." : "Генерировать"}
          </button>

          {isFullOutfit && garmentImages.length > 0 && garmentImages.length < 2 && (
            <p className="text-amber-400 text-sm text-center">
              Для полного костюма нужно 2 фото одежды: верх (1-е) и низ (2-е)
            </p>
          )}

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          {/* Result */}
          <ResultPanel
            resultUrl={resultUrl}
            loading={loading}
            history={history}
            onHistorySelect={setResultUrl}
            onInpainted={(newUrl) => {
              setResultUrl(newUrl);
              setHistory((prev) => [newUrl, ...prev]);
            }}
          />
        </div>
      </main>

      {/* Template Manager Modal */}
      <TemplateManager
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onLoad={loadTemplate}
        currentState={{
          modelImage: modelImages[0] || null,
          garmentImages,
          settings,
          previewUrl: resultUrl,
        }}
      />
    </div>
  );
}
