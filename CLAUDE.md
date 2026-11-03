# virtual-tryon-studio

Next.js 16 (App Router) app for AI virtual try-on and product photoshoots: upload a model photo and garment photos, pick a pipeline, get a catalog-style image. See README.md for the pipeline/model table.

## Layout
- `app/page.tsx` — single-page UI; `app/components/` — drop zones, settings, result panel, inpaint editor, template manager
- `app/api/tryon` — main generation endpoint, dispatches on `settings.aiModel`; `app/api/inpaint` — region regeneration
- `app/api/upload`, `app/api/files/[filename]` — local file store under `data/`
- `app/api/templates`, `app/api/generations` — SQLite-backed history and saved presets
- `lib/providers.ts` — all Replicate / fal.ai calls, one function per model, `runWithRetry` for 429s
- `lib/image-utils.ts` — `sharp` helpers (masks, compositing, aspect crop)
- `lib/db/` — Drizzle + `better-sqlite3`, schema and `AiModel` / `TryOnSettings` types
- `middleware.ts` — cookie password gate driven by `APP_PASSWORD`

## Commands
- `npm run dev` — dev server; `npm run build` / `npm run start` — production; `npm run lint` — ESLint
- Env: copy `.env.example` to `.env` (`REPLICATE_API_TOKEN`, `FAL_KEY`, `APP_PASSWORD`)

## Conventions
- Adding a model: add a function in `lib/providers.ts`, extend `AiModel` in `lib/db/schema.ts`, add a branch in `app/api/tryon/route.ts`, add the option in `app/components/Settings.tsx`
- Provider responses are shape-checked for an image URL; throw with the model name if none is found
- Never read uploads by raw path — always `path.basename` against `UPLOADS_DIR` / `RESULTS_DIR`
- `data/`, `input/`, `output/` and `.env` are git-ignored; never commit generated images or keys
