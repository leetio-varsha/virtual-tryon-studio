import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const templates = sqliteTable("templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  modelImagePath: text("model_image_path").notNull(),
  garmentImagePaths: text("garment_image_paths").notNull(), // JSON array
  settings: text("settings").notNull(), // JSON object
  previewPath: text("preview_path"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const generations = sqliteTable("generations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  templateId: integer("template_id").references(() => templates.id),
  modelImagePath: text("model_image_path").notNull(),
  garmentImagePath: text("garment_image_path").notNull(),
  settings: text("settings").notNull(), // JSON object
  resultImagePath: text("result_image_path").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type Template = typeof templates.$inferSelect;
export type Generation = typeof generations.$inferSelect;

export type AiModel = "idm-vton" | "fashn-v1.6" | "leffa";

export interface TryOnSettings {
  aiModel: AiModel;
  category: "upper_body" | "lower_body" | "dresses" | "full_outfit";
  steps: number;
  seed: number | null;
  prompt: string;
  crop: boolean;
  scenePrompt: string;
  finalPrompt: string;
  aspectRatio: "4:5" | "1:1" | "9:16";
  hdUpscale: boolean;
}
