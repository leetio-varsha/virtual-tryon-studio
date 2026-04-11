# stim-banana

Virtual try-on project for Instagram clothing store.
Uses IDM-VTON model via Replicate API to dress models in specific garments.

## Stack
- Node.js / TypeScript
- Replicate API (IDM-VTON model)
- Sharp for image processing

## Key Requirements
- Preserve clothing details: seams, textures, logos, patterns
- High fidelity output suitable for Instagram
- Input: model photo + garment photo → output: model wearing the garment

## Directories
- `input/models/` — photos of models (gitignored)
- `input/garments/` — photos of garments (gitignored)
- `output/` — generated results (gitignored)
- `src/` — source code

## Commands
- `npm run generate` — run generation
- `npm run dev` — development mode
