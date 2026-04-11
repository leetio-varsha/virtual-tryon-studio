"use client";

import { useEffect, useState } from "react";
import type { TryOnSettings } from "@/lib/db/schema";

interface TemplateData {
  id: number;
  name: string;
  modelImagePath: string;
  garmentImagePaths: string;
  settings: string;
  previewPath: string | null;
}

interface TemplateManagerProps {
  open: boolean;
  onClose: () => void;
  onLoad: (data: {
    modelImage: string;
    garmentImages: string[];
    settings: TryOnSettings;
  }) => void;
  currentState: {
    modelImage: string | null;
    garmentImages: string[];
    settings: TryOnSettings;
    previewUrl: string | null;
  };
}

export default function TemplateManager({ open, onClose, onLoad, currentState }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) {
      fetch("/api/templates")
        .then((r) => r.json())
        .then(setTemplates)
        .catch(console.error);
    }
  }, [open]);

  const saveTemplate = async () => {
    if (!name.trim() || !currentState.modelImage) return;
    setSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          modelImagePath: currentState.modelImage,
          garmentImagePaths: currentState.garmentImages,
          settings: currentState.settings,
          previewPath: currentState.previewUrl,
        }),
      });
      const created = await res.json();
      setTemplates((prev) => [created, ...prev]);
      setName("");
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const loadTemplate = (t: TemplateData) => {
    onLoad({
      modelImage: t.modelImagePath,
      garmentImages: JSON.parse(t.garmentImagePaths),
      settings: JSON.parse(t.settings),
    });
    onClose();
  };

  const deleteTemplate = async (id: number) => {
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Шаблоны</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground text-xl">x</button>
        </div>

        {/* Save current */}
        {currentState.modelImage && (
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название шаблона..."
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
            <button
              onClick={saveTemplate}
              disabled={saving || !name.trim()}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? "..." : "Сохранить"}
            </button>
          </div>
        )}

        {/* Template list */}
        {templates.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">Нет сохранённых шаблонов</p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-background hover:bg-surface-hover cursor-pointer transition-colors"
                onClick={() => loadTemplate(t)}
              >
                {t.previewPath && (
                  <img src={t.previewPath} alt="" className="w-12 h-12 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <p className="text-xs text-muted">
                    {JSON.parse(t.garmentImagePaths).length} фото одежды
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                  className="text-muted hover:text-red-500 text-sm transition-colors"
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
