"use client";

interface ResultPanelProps {
  resultUrl: string | null;
  loading: boolean;
  history: string[];
  onHistorySelect: (url: string) => void;
}

export default function ResultPanel({
  resultUrl,
  loading,
  history,
  onHistorySelect,
}: ResultPanelProps) {
  const downloadImage = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `tryon_${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="rounded-xl bg-surface border border-border p-4">
      <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
        Результат
      </h3>

      {/* Main result */}
      <div className="relative aspect-[3/4] max-h-[500px] bg-background rounded-lg overflow-hidden flex items-center justify-center mb-3">
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted">Генерация... ~20-30 сек</p>
          </div>
        ) : resultUrl ? (
          <img src={resultUrl} alt="Result" className="w-full h-full object-contain" />
        ) : (
          <p className="text-sm text-muted">Нажмите «Генерировать» чтобы начать</p>
        )}
      </div>

      {/* Actions */}
      {resultUrl && !loading && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={downloadImage}
            className="flex-1 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
          >
            Скачать
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
  );
}
