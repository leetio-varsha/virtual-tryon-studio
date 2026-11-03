# Virtual Try-On Studio

A self-hosted Next.js app for producing catalog-style photos of a person wearing a given garment. You upload a model photo and one or two garment photos, pick a pipeline (a dedicated try-on model, a general image-editing model used as a "photoshoot" generator, or a hybrid chain of both), tune a few settings, and get back a result cropped to a social-media aspect ratio. Results and reusable templates are stored locally in SQLite, and an inpainting editor lets you brush over a region of a result and regenerate just that area, optionally guided by a reference crop of the garment. Built for a small Instagram clothing store that needed product photos without a studio.

## Pipelines / models

All providers are called from `lib/providers.ts`; the per-pipeline orchestration lives in `app/api/tryon/route.ts`.

| Setting value (`aiModel`) | What it does | Provider / endpoint | Env key |
| --- | --- | --- | --- |
| `fashn-v1.6` | Garment try-on with category, quality mode and garment-photo-type hints | fal.ai `fal-ai/fashn/tryon/v1.6` | `FAL_KEY` |
| `leffa` | Garment try-on (steps, guidance scale) | fal.ai `fal-ai/leffa/virtual-tryon` | `FAL_KEY` |
| `idm-vton` | Garment try-on (steps, crop, garment description) | Replicate `cuuupid/idm-vton` | `REPLICATE_API_TOKEN` |
| `flux-photoshoot` | One-shot "person from image 1 wearing outfit from image 2" in a described scene | fal.ai `fal-ai/flux-2-pro/edit` | `FAL_KEY` |
| `grok-photoshoot` | Same prompt pattern, fast and cheap | fal.ai `xai/grok-imagine-image/edit` | `FAL_KEY` |
| `gemini-photoshoot` | Same prompt pattern, stronger face preservation | fal.ai `fal-ai/gemini-3-pro-image-preview/edit` | `FAL_KEY` |
| `gpt-image-photoshoot` | Same prompt pattern, output size chosen from aspect ratio | fal.ai `fal-ai/gpt-image-1.5/edit` | `FAL_KEY` |
| `hybrid-fashn-flux` | FASHN try-on, then FLUX.2 Pro Edit re-renders the scene with garment images as references | fal.ai (both) | `FAL_KEY` |
| `hybrid-v2` | FASHN try-on, then Grok scene enhancement, then optional Gemini face fix from a reference photo | fal.ai (all three) | `FAL_KEY` |

Post-processing steps that any pipeline can add:

| Step | When it runs | Provider | Env key |
| --- | --- | --- | --- |
| Face swap | `faceSwap` enabled and a face reference uploaded (all pipelines except `hybrid-v2`, which uses Gemini instead) | fal.ai `half-moon-ai/ai-face-swap/faceswapimage` | `FAL_KEY` |
| Background replacement | Try-on pipelines only, when a scene or style prompt is given: remove background, build an inverted alpha mask, inpaint the background | Replicate `lucataco/remove-bg` + `black-forest-labs/flux-fill-pro` | `REPLICATE_API_TOKEN` |
| HD upscale (2x, face enhance) | `hdUpscale` not disabled (default on) | Replicate `nightmareai/real-esrgan` | `REPLICATE_API_TOKEN` |
| Crop to `4:5`, `1:1` or `9:16` | Hybrid pipelines always; try-on pipelines when the ratio is not `4:5` or a scene prompt was used | local (`sharp`) | none |

Inpainting (`app/api/inpaint/route.ts`): mask-only mode uses Replicate `flux-fill-pro`; reference-guided mode sends the image plus a reference crop to one of `flux-edit`, `grok`, `gemini` or `gpt-image` (all via fal.ai) and composites only the masked region back onto the original.

## Requirements

- Node.js 20 or newer (`@types/node` is pinned to 20; `better-sqlite3` and `sharp` are native modules)
- A [Replicate](https://replicate.com) API token and a [fal.ai](https://fal.ai) key. Every pipeline needs at least one of them; see the tables above.

## Setup

```bash
cp .env.example .env     # fill in REPLICATE_API_TOKEN, FAL_KEY, APP_PASSWORD
npm install
npm run dev              # http://localhost:3000
```

`npm run build && npm run start` for production. `npm run lint` runs ESLint.

The app creates `data/` on first start (SQLite database, uploads, results). `data/`, `input/` and `output/` are git-ignored.

## How it works

- `middleware.ts` — password gate. Every route except `/_next/static`, `/_next/image`, `/favicon.ico` and `/api/files/*` requires a cookie equal to `APP_PASSWORD`; otherwise the request is redirected to `/login`, which just sets that cookie. If `APP_PASSWORD` is not set, the gate is disabled and a warning is logged at startup. This is a shared-secret gate for a small private deployment, not a user system.
- `app/page.tsx` — single-page UI: model drop zone, garment drop zone (two garments for `full_outfit`), settings panel, result panel with history, template manager.
- `app/components/` — `ImageDropZone`, `Settings` (model selector, category, prompts, aspect ratio, per-model options, face swap, upscale), `ResultPanel`, `InpaintEditor` (canvas brush, model selector, reference upload), `TemplateManager`.
- `app/api/upload` — saves files to `data/uploads/` under a timestamped random name and returns `/api/files/<name>` URLs.
- `app/api/tryon` — the main generation endpoint. Reads the uploaded files from disk, encodes them as data URIs, dispatches on `settings.aiModel` to one of the pipelines above, applies the optional steps, writes the PNG to `data/results/` and inserts a row into `generations`.
- `app/api/inpaint` — region regeneration for an existing result or upload.
- `app/api/files/[filename]` — serves uploads and results (`path.basename` guards against traversal; long-lived cache headers).
- `app/api/templates`, `app/api/templates/[id]` — CRUD for saved model + garments + settings combinations.
- `app/api/generations` — last 50 generations, newest first.
- `lib/providers.ts` — one function per external model, a `runTryOn` router for the three try-on models, and `runWithRetry` (retries up to 3 times on 429 / rate-limit errors with a 10s, 20s, 30s backoff).
- `lib/image-utils.ts` — `sharp` helpers: inverted alpha mask, masked compositing, center crop to aspect ratio.
- `lib/db/` — Drizzle ORM over `better-sqlite3` (WAL mode); tables `templates` and `generations` are created on startup.

## Notes on cost and limits

- Every generation is a chain of paid API calls; a single hybrid run can make 4-6 calls (two FASHN passes for a full outfit, a scene model, face fix, upscale). Figures shown in the UI model selector (for example "6s / $0.02" for Grok and "65s / $0.26" for GPT Image) are approximate per-call prices as observed during development and are not kept in sync with provider pricing.
- Images are passed to providers as base64 data URIs read from disk; large uploads mean large request bodies. There is no size validation on upload.
- `runWithRetry` only retries rate-limit errors; any other provider error fails the request with a 500 and the error message.
- Intermediate results are fetched back from provider URLs between steps; only the final image is stored locally.
- SQLite and the file store are local to the machine running the app. There is no multi-user isolation; everyone with the password shares the same history and templates.

## License

MIT — see [LICENSE](LICENSE).
