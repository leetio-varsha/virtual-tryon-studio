"use client";

import { useCallback, useState } from "react";

interface ImageDropZoneProps {
  label: string;
  multiple?: boolean;
  images: string[];
  selectedIndex?: number;
  onImagesChange: (images: string[]) => void;
  onSelect?: (index: number) => void;
  slotLabels?: Record<number, string>;
}

export default function ImageDropZone({
  label,
  multiple = false,
  images,
  selectedIndex = 0,
  onImagesChange,
  onSelect,
  slotLabels,
}: ImageDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.paths) {
          if (multiple) {
            onImagesChange([...images, ...data.paths]);
          } else {
            onImagesChange([data.paths[0]]);
          }
        }
      } catch (e) {
        console.error("Upload failed:", e);
      } finally {
        setUploading(false);
      }
    },
    [images, multiple, onImagesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files);
      }
    },
    [uploadFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        uploadFiles(e.target.files);
      }
    },
    [uploadFiles]
  );

  const removeImage = (index: number) => {
    const next = images.filter((_, i) => i !== index);
    onImagesChange(next);
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <h3 className="text-sm font-medium text-muted uppercase tracking-wider">{label}</h3>

      {/* Drop zone */}
      <label
        className={`
          relative flex-1 min-h-[200px] rounded-xl border-2 border-dashed cursor-pointer
          flex items-center justify-center transition-colors
          ${dragging ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"}
          ${uploading ? "opacity-50 pointer-events-none" : ""}
        `}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={handleFileInput}
        />
        {images.length === 0 ? (
          <div className="text-center p-6">
            <div className="text-4xl mb-2 opacity-40">+</div>
            <p className="text-sm text-muted">
              {uploading ? "Загрузка..." : `Перетащите ${multiple ? "фото" : "фото"} сюда`}
            </p>
          </div>
        ) : !multiple ? (
          <div className="relative w-full h-full p-2">
            <img
              src={images[0]}
              alt="Model"
              className="w-full h-full object-contain rounded-lg"
            />
            <button
              onClick={(e) => { e.preventDefault(); removeImage(0); }}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
            >
              x
            </button>
          </div>
        ) : null}
      </label>

      {/* Multiple images grid */}
      {multiple && images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((src, i) => (
            <div
              key={i}
              className={`
                relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-colors
                ${i === selectedIndex ? "border-accent" : "border-transparent hover:border-accent/50"}
              `}
              onClick={() => onSelect?.(i)}
            >
              <img src={src} alt={`Garment ${i + 1}`} className="w-full h-full object-cover" />
              {slotLabels?.[i] && (
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium">
                  {slotLabels[i]}
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
              >
                x
              </button>
            </div>
          ))}
          {/* Add more button */}
          <label className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-accent/50 flex items-center justify-center cursor-pointer transition-colors">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
            <span className="text-2xl text-muted">+</span>
          </label>
        </div>
      )}
    </div>
  );
}
