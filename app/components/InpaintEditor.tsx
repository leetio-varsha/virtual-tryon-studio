"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface InpaintEditorProps {
  open: boolean;
  imageUrl: string | null;
  onClose: () => void;
  onApplied: (newUrl: string) => void;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  size: number;
}

export default function InpaintEditor({ open, imageUrl, onClose, onApplied }: InpaintEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [brushSize, setBrushSize] = useState(40);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const [prompt, setPrompt] = useState("");
  const [referenceDataUri, setReferenceDataUri] = useState<string | null>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on open or when image changes (e.g. after applying inpaint)
  useEffect(() => {
    setStrokes([]);
    setRedoStack([]);
    setPrompt("");
    setReferenceDataUri(null);
    setError(null);
  }, [open, imageUrl]);

  // Load image into canvas when opened
  useEffect(() => {
    if (!open || !imageUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      redraw();
    };
    img.src = imageUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, imageUrl]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Overlay strokes in semi-transparent red
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(239, 68, 68, 0.55)";
    ctx.fillStyle = "rgba(239, 68, 68, 0.55)";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const stroke of strokes) {
      ctx.lineWidth = stroke.size;
      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        ctx.beginPath();
        ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }
    }
  }, [strokes]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX: number, clientY: number;
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startStroke = (e: React.MouseEvent | React.TouchEvent) => {
    const p = getCanvasPoint(e);
    if (!p) return;
    setDrawing(true);
    currentStrokeRef.current = { points: [p], size: brushSize };
    setStrokes((prev) => [...prev, currentStrokeRef.current!]);
    setRedoStack([]);
  };

  const continueStroke = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing || !currentStrokeRef.current) return;
    const p = getCanvasPoint(e);
    if (!p) return;
    currentStrokeRef.current.points.push(p);
    // Trigger rerender of strokes
    setStrokes((prev) => [...prev.slice(0, -1), currentStrokeRef.current!]);
  };

  const endStroke = () => {
    setDrawing(false);
    currentStrokeRef.current = null;
  };

  const undo = () => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [...r, last]);
      return prev.slice(0, -1);
    });
  };

  const redo = () => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setStrokes((s) => [...s, last]);
      return prev.slice(0, -1);
    });
  };

  const clear = () => {
    setStrokes([]);
    setRedoStack([]);
  };

  const exportMask = (): string | null => {
    const img = imageRef.current;
    if (!img) return null;
    const mask = document.createElement("canvas");
    mask.width = img.naturalWidth;
    mask.height = img.naturalHeight;
    const ctx = mask.getContext("2d");
    if (!ctx) return null;
    // Black background (keep area)
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, mask.width, mask.height);
    // White strokes (regenerate area)
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokes) {
      ctx.lineWidth = stroke.size;
      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        ctx.beginPath();
        ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }
    }
    return mask.toDataURL("image/png");
  };

  const apply = async () => {
    if (!imageUrl || strokes.length === 0 || !prompt.trim()) return;
    const mask = exportMask();
    if (!mask) {
      setError("Не удалось создать маску");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inpaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagePath: imageUrl,
          maskDataUri: mask,
          prompt: prompt.trim(),
          ...(referenceDataUri ? { referenceDataUri } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Inpaint failed");
      onApplied(data.resultUrl);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const canApply = strokes.length > 0 && prompt.trim().length > 0 && !loading;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Редактировать область</h2>
            <p className="text-xs text-muted mt-0.5">
              Закрась проблемную зону (красным), опиши что там должно быть, AI перерисует только её.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-9 h-9 rounded-full bg-background text-muted hover:text-foreground hover:bg-background/80 flex items-center justify-center text-lg disabled:opacity-50"
          >
            x
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-black/40 flex items-center justify-center p-4">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-[65vh] object-contain rounded-lg cursor-crosshair touch-none"
            style={{ imageRendering: "auto" }}
            onMouseDown={startStroke}
            onMouseMove={continueStroke}
            onMouseUp={endStroke}
            onMouseLeave={endStroke}
            onTouchStart={startStroke}
            onTouchMove={continueStroke}
            onTouchEnd={endStroke}
          />
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-border space-y-3">
          {/* Brush + undo */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs text-muted mb-1">Размер кисти: {brushSize}px</label>
              <input
                type="range"
                min={5}
                max={120}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={undo}
                disabled={strokes.length === 0 || loading}
                className="px-3 py-2 bg-background border border-border rounded-lg text-xs hover:border-accent transition-colors disabled:opacity-40"
                title="Отменить последний штрих"
              >
                Undo
              </button>
              <button
                onClick={redo}
                disabled={redoStack.length === 0 || loading}
                className="px-3 py-2 bg-background border border-border rounded-lg text-xs hover:border-accent transition-colors disabled:opacity-40"
                title="Вернуть"
              >
                Redo
              </button>
              <button
                onClick={clear}
                disabled={strokes.length === 0 || loading}
                className="px-3 py-2 bg-background border border-border rounded-lg text-xs hover:border-red-500 transition-colors disabled:opacity-40"
              >
                Очистить
              </button>
            </div>
          </div>

          {/* Prompt + Reference */}
          <div className="space-y-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Что должно быть в этой области? Например: flatlock seams, black contrast stitching along sleeves"
              disabled={loading}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent disabled:opacity-50"
            />

            {/* Reference image */}
            <div className="flex items-center gap-3">
              {referenceDataUri ? (
                <>
                  <img
                    src={referenceDataUri}
                    alt="Reference"
                    className="w-14 h-14 rounded-lg object-cover border border-accent"
                  />
                  <div className="flex-1">
                    <p className="text-xs text-muted">Референс загружен — AI скопирует детали с него</p>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => refInputRef.current?.click()}
                        disabled={loading}
                        className="text-xs px-2 py-1 bg-background border border-border rounded hover:border-accent transition-colors disabled:opacity-50"
                      >
                        Заменить
                      </button>
                      <button
                        onClick={() => setReferenceDataUri(null)}
                        disabled={loading}
                        className="text-xs px-2 py-1 bg-background border border-border rounded hover:border-red-500 transition-colors disabled:opacity-50"
                      >
                        Убрать
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => refInputRef.current?.click()}
                  disabled={loading}
                  className="flex-1 py-2 border border-dashed border-border rounded-lg text-xs text-muted hover:border-accent hover:text-foreground transition-colors disabled:opacity-50"
                >
                  + Загрузить референс (фото оригинальной одежды/детали)
                </button>
              )}
              <input
                ref={refInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setReferenceDataUri(reader.result as string);
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
            </div>

            <p className="text-xs text-muted">
              {referenceDataUri
                ? "AI увидит оригинальную одежду и точно скопирует швы, текстуру и цвет в замаскированную область."
                : "Опиши на английском. Добавь референс — AI точнее скопирует детали одежды."}
            </p>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* Apply */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 bg-background border border-border rounded-lg text-sm hover:border-accent transition-colors disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              onClick={apply}
              disabled={!canApply}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                canApply
                  ? "bg-accent hover:bg-accent-hover text-white"
                  : "bg-background text-muted cursor-not-allowed border border-border"
              }`}
            >
              {loading ? "Перерисовка... ~20 сек" : "Применить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
