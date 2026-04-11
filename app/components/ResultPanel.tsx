"use client";

import { useState } from "react";
import InpaintEditor from "./InpaintEditor";

interface ResultPanelProps {
  resultUrl: string | null;
  loading: boolean;
  history: string[];
  onHistorySelect: (url: string) => void;
  onInpainted?: (url: string) => void;
}

export default function ResultPanel({
  resultUrl,
  loading,
  history,
  onHistorySelect,
  onInpainted,
}: ResultPanelProps) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const downloadImage = async (url: string) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `tryon_${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  return (
    <>
      <div className="rounded-xl bg-surface border border-border p-4">
        <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
          Результат
        </h3>

        {/* Main result */}
        <div className="relative aspect-[3/4] max-h-[500px] bg-background rounded-lg overflow-hidden flex items-center justify-center mb-3">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted">Генерация... ~30-60 сек</p>
            <p className="text-xs text-muted mt-1">(«Полный костюм» делает 2 прохода — дольше)</p>
            </div>
          ) : resultUrl ? (
            <img
              src={resultUrl}
              alt="Result"
              className="w-full h-full object-contain cursor-pointer"
              onClick={() => setLightbox(resultUrl)}
              title="Нажмите чтобы увеличить"
            />
          ) : (
            <p className="text-sm text-muted">Нажмите «Генерировать» чтобы начать</p>
          )}
        </div>

        {/* Actions */}
        {resultUrl && !loading && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => downloadImage(resultUrl)}
              className="flex-1 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
            >
              Скачать
            </button>
            <button
              onClick={() => setEditorOpen(true)}
              className="px-4 py-2 bg-surface border border-border rounded-lg text-sm hover:border-accent transition-colors"
              title="Перерисовать отдельную область кистью"
            >
              Редактировать
            </button>
            <button
              onClick={() => setLightbox(resultUrl)}
              className="px-4 py-2 bg-surface border border-border rounded-lg text-sm hover:border-accent transition-colors"
            >
              Увеличить
            </button>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div>
            <p className="text-xs text-muted mb-2">История:</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {history.map((url, i) => (
                <button
                  key={i}
                  onClick={() => onHistorySelect(url)}
                  className={`
                    flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors
                    ${url === resultUrl ? "border-accent" : "border-border hover:border-accent/50"}
                  `}
                >
                  <img src={url} alt={`Result ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Inpaint editor */}
      <InpaintEditor
        open={editorOpen}
        imageUrl={resultUrl}
        onClose={() => setEditorOpen(false)}
        onApplied={(newUrl) => {
          onInpainted?.(newUrl);
        }}
      />

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-[95vw] max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox}
              alt="Enlarged result"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <div className="absolute top-3 right-3 flex gap-2">
              <button
                onClick={() => downloadImage(lightbox)}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
              >
                Скачать
              </button>
              <button
                onClick={() => setLightbox(null)}
                className="w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center text-lg hover:bg-red-600 transition-colors"
              >
                x
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
