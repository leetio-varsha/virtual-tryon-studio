import Replicate from "replicate";
import { fal } from "@fal-ai/client";
import type { AiModel } from "./db/schema";

// --- Clients ---

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

fal.config({ credentials: process.env.FAL_KEY });

// --- Retry logic ---

export async function runWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if ((message.includes("429") || message.includes("rate")) && attempt < maxRetries) {
        const wait = 10 * (attempt + 1);
        console.log(`[Retry] Rate limited, waiting ${wait}s (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

// --- Types ---

export interface TryOnInput {
  humanImage: string;
  garmentImage: string;
  category: string;
  prompt: string;
  steps: number;
  seed: number | null;
  crop: boolean;
  // FASHN-specific
  fashnMode?: "performance" | "balanced" | "quality";
  garmentPhotoType?: "auto" | "flat-lay" | "model";
  // Leffa-specific
  guidanceScale?: number;
}

// --- IDM-VTON (Replicate) ---

const IDM_VTON_MODEL = "cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985";

async function runIdmVton(input: TryOnInput): Promise<string> {
  console.log(`[IDM-VTON] category=${input.category}, steps=${input.steps}`);
  const output = await runWithRetry(() =>
    replicate.run(IDM_VTON_MODEL, {
      input: {
        human_img: input.humanImage,
        garm_img: input.garmentImage,
        garment_des: input.prompt || "clothing item",
        category: input.category,
        steps: input.steps,
        seed: input.seed ?? 42,
        crop: input.crop,
      },
    })
  );
  return output as unknown as string;
}

// --- FASHN v1.6 (fal.ai) ---

const FASHN_CATEGORIES: Record<string, "tops" | "bottoms" | "one-pieces" | "auto"> = {
  upper_body: "tops",
  lower_body: "bottoms",
  dresses: "one-pieces",
};

async function runFashn(input: TryOnInput): Promise<string> {
  const category = FASHN_CATEGORIES[input.category] ?? "tops";
  const mode = input.fashnMode ?? "quality";
  console.log(`[FASHN v1.6] category=${category}, mode=${mode}, garmentPhoto=${input.garmentPhotoType ?? "auto"}`);
  const result = await runWithRetry(() =>
    fal.subscribe("fal-ai/fashn/tryon/v1.6", {
      input: {
        model_image: input.humanImage,
        garment_image: input.garmentImage,
        category,
        mode,
        garment_photo_type: input.garmentPhotoType ?? "auto",
        ...(input.seed != null ? { seed: input.seed } : {}),
      },
    })
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any;
  const url = r?.data?.image?.url ?? r?.image?.url ?? r?.data?.images?.[0]?.url ?? r?.images?.[0]?.url;
  if (!url) {
    console.error("[FASHN] Unexpected response:", JSON.stringify(r).slice(0, 500));
    throw new Error("FASHN returned no image URL");
  }
  return url;
}

// --- Leffa (fal.ai) ---

async function runLeffa(input: TryOnInput): Promise<string> {
  console.log(`[Leffa] garment_type=${input.category}, steps=${input.steps}`);
  const result = await runWithRetry(() =>
    fal.subscribe("fal-ai/leffa/virtual-tryon", {
      input: {
        human_image_url: input.humanImage,
        garment_image_url: input.garmentImage,
        garment_type: input.category as "upper_body" | "lower_body" | "dresses",
        num_inference_steps: Math.min(input.steps, 50),
        guidance_scale: input.guidanceScale ?? 2.5,
        ...(input.seed != null ? { seed: input.seed } : {}),
      },
    })
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any;
  const url = r?.data?.image?.url ?? r?.image?.url ?? r?.data?.images?.[0]?.url ?? r?.images?.[0]?.url;
  if (!url) {
    console.error("[Leffa] Unexpected response:", JSON.stringify(r).slice(0, 500));
    throw new Error("Leffa returned no image URL");
  }
  return url;
}

// --- FLUX.2 Pro Edit (fal.ai) — Full photoshoot pipeline ---

export interface PhotoshootInput {
  modelImage: string;      // data URI of the model/person
  garmentImage: string;     // data URI of the garment
  scenePrompt: string;      // scene description
  finalPrompt: string;      // style/quality prompt
  aspectRatio: string;      // "4:5", "1:1", "9:16"
  seed?: number | null;
}

export async function runPhotoshoot(input: PhotoshootInput): Promise<string> {
  const scene = input.scenePrompt || "clean studio background";
  const style = input.finalPrompt || "professional fashion photography, sharp details, 4K";
  const prompt = `The person from @image1 wearing the outfit from @image2, ${scene}, ${style}`;

  console.log(`[Photoshoot] FLUX.2 Pro Edit — prompt: "${prompt.slice(0, 120)}..."`);

  const result = await runWithRetry(() =>
    fal.subscribe("fal-ai/flux-2-pro/edit", {
      input: {
        image_urls: [input.modelImage, input.garmentImage],
        prompt,
        ...(input.seed != null ? { seed: input.seed } : {}),
      },
    })
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any;
  const url = r?.data?.images?.[0]?.url ?? r?.images?.[0]?.url ?? r?.data?.image?.url ?? r?.image?.url;
  if (!url) {
    console.error("[Photoshoot] Unexpected response:", JSON.stringify(r).slice(0, 500));
    throw new Error("FLUX.2 Pro Edit returned no image URL");
  }
  console.log("[Photoshoot] Done");
  return url;
}

// --- Grok Imagine (xAI via fal.ai) — Fast photoshoot pipeline ---

export async function runGrokPhotoshoot(input: PhotoshootInput): Promise<string> {
  const scene = input.scenePrompt || "clean studio background";
  const style = input.finalPrompt || "professional fashion photography, sharp details, 4K";
  const prompt = `The person from @image1 wearing the outfit from @image2, ${scene}, ${style}`;

  console.log(`[Grok] Grok Imagine Edit — prompt: "${prompt.slice(0, 120)}..."`);

  const result = await runWithRetry(() =>
    fal.subscribe("xai/grok-imagine-image/edit", {
      input: {
        image_urls: [input.modelImage, input.garmentImage],
        prompt,
        ...(input.seed != null ? { seed: input.seed } : {}),
      },
    })
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any;
  const url = r?.data?.images?.[0]?.url ?? r?.images?.[0]?.url ?? r?.data?.image?.url ?? r?.image?.url;
  if (!url) {
    console.error("[Grok] Unexpected response:", JSON.stringify(r).slice(0, 500));
    throw new Error("Grok Imagine returned no image URL");
  }
  console.log("[Grok] Done");
  return url;
}

// --- Gemini 3 Pro (fal.ai) — Photoshoot with strong face reference ---

export async function runGeminiPhotoshoot(input: PhotoshootInput): Promise<string> {
  const scene = input.scenePrompt || "clean studio background";
  const style = input.finalPrompt || "professional fashion photography, sharp details, 4K";
  const prompt = `The person from @image1 wearing the outfit from @image2, ${scene}, ${style}`;

  console.log(`[Gemini] Gemini 3 Pro Edit — prompt: "${prompt.slice(0, 120)}..."`);

  const result = await runWithRetry(() =>
    fal.subscribe("fal-ai/gemini-3-pro-image-preview/edit", {
      input: {
        image_urls: [input.modelImage, input.garmentImage],
        prompt,
        ...(input.seed != null ? { seed: input.seed } : {}),
      },
    })
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any;
  const url = r?.data?.images?.[0]?.url ?? r?.images?.[0]?.url ?? r?.data?.image?.url ?? r?.image?.url;
  if (!url) {
    console.error("[Gemini] Unexpected response:", JSON.stringify(r).slice(0, 500));
    throw new Error("Gemini 3 Pro returned no image URL");
  }
  console.log("[Gemini] Done");
  return url;
}

// --- GPT Image 1.5 (OpenAI via fal.ai) — Max quality photoshoot ---

const GPT_IMAGE_SIZES: Record<string, string> = {
  "4:5": "1024x1280",
  "1:1": "1024x1024",
  "9:16": "720x1280",
};

export async function runGptImagePhotoshoot(input: PhotoshootInput): Promise<string> {
  const scene = input.scenePrompt || "clean studio background";
  const style = input.finalPrompt || "professional fashion photography, sharp details, 4K";
  const prompt = `The person from @image1 wearing the outfit from @image2, ${scene}, ${style}`;
  const imageSize = GPT_IMAGE_SIZES[input.aspectRatio] || "1024x1280";

  console.log(`[GPT-Image] GPT Image 1.5 Edit — size=${imageSize}, prompt: "${prompt.slice(0, 120)}..."`);

  const result = await runWithRetry(() =>
    fal.subscribe("fal-ai/gpt-image-1.5/edit", {
      input: {
        image_urls: [input.modelImage, input.garmentImage],
        prompt,
        image_size: imageSize,
        ...(input.seed != null ? { seed: input.seed } : {}),
      },
    })
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any;
  const url = r?.data?.images?.[0]?.url ?? r?.images?.[0]?.url ?? r?.data?.image?.url ?? r?.image?.url;
  if (!url) {
    console.error("[GPT-Image] Unexpected response:", JSON.stringify(r).slice(0, 500));
    throw new Error("GPT Image 1.5 returned no image URL");
  }
  console.log("[GPT-Image] Done");
  return url;
}

// --- Hybrid enhance: FASHN result → FLUX.2 Pro Edit for photorealistic scene ---

export interface HybridEnhanceInput {
  fashnResultImage: string;   // data URI of FASHN try-on output
  garmentImages: string[];     // original garment data URIs (1 or 2 for full outfit)
  scenePrompt: string;
  finalPrompt: string;
  aspectRatio?: string;
  seed?: number | null;
}

export async function runHybridEnhance(input: HybridEnhanceInput): Promise<string> {
  const scene = input.scenePrompt || "clean studio background";
  const style = input.finalPrompt || "professional fashion photography, sharp details, 4K";

  const imageUrls = [input.fashnResultImage, ...input.garmentImages];
  const isFullOutfit = input.garmentImages.length >= 2;

  const clothingRef = isFullOutfit
    ? "top matching @image2 and bottom matching @image3"
    : "matching @image2";

  const prompt = [
    `The person from @image1 in ${scene},`,
    `wearing the exact same outfit with all original clothing details,`,
    `seams, logos, textures, patterns and colors perfectly preserved ${clothingRef},`,
    style,
  ].join(" ");

  console.log(`[Hybrid] FLUX.2 Pro Edit enhance — ${imageUrls.length} refs, prompt: "${prompt.slice(0, 120)}..."`);

  const result = await runWithRetry(() =>
    fal.subscribe("fal-ai/flux-2-pro/edit", {
      input: {
        image_urls: imageUrls,
        prompt,
        ...(input.seed != null ? { seed: input.seed } : {}),
      },
    })
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any;
  const url = r?.data?.images?.[0]?.url ?? r?.images?.[0]?.url ?? r?.data?.image?.url ?? r?.image?.url;
  if (!url) {
    console.error("[Hybrid] Unexpected response:", JSON.stringify(r).slice(0, 500));
    throw new Error("FLUX.2 Pro Edit (hybrid enhance) returned no image URL");
  }
  console.log("[Hybrid] Scene enhancement done");
  return url;
}

// --- Face swap (Half-Moon AI via fal.ai) ---

export async function swapFace(
  sourceFaceImage: string,
  targetImage: string,
): Promise<string> {
  console.log("[FaceSwap] Running Half-Moon AI face swap...");
  const result = await runWithRetry(() =>
    fal.subscribe("half-moon-ai/ai-face-swap/faceswapimage", {
      input: {
        source_face_url: sourceFaceImage,
        target_image_url: targetImage,
      },
    })
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const url = (result as any)?.image?.url ?? (result as any)?.data?.image?.url;
  if (!url) {
    throw new Error("Face swap returned no image URL");
  }
  console.log("[FaceSwap] Done");
  return url;
}

// --- Router ---

export async function runTryOn(model: AiModel, input: TryOnInput): Promise<string> {
  switch (model) {
    case "idm-vton":
      return runIdmVton(input);
    case "fashn-v1.6":
      return runFashn(input);
    case "leffa":
      return runLeffa(input);
    default:
      throw new Error(`Unknown model: ${model}`);
  }
}

// --- Replicate helpers (bg removal, upscale, inpaint) ---

const BG_REMOVE_MODEL = "lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1";
const INPAINT_MODEL = "black-forest-labs/flux-fill-pro";
const UPSCALE_MODEL = "nightmareai/real-esrgan";

export async function removeBackground(imageDataUri: string): Promise<string> {
  console.log("[Pipeline] Removing background...");
  const output = await runWithRetry(() =>
    replicate.run(BG_REMOVE_MODEL, { input: { image: imageDataUri } })
  );
  console.log("[Pipeline] Background removed");
  return output as unknown as string;
}

export async function replaceBackground(
  imageDataUri: string,
  maskDataUri: string,
  scenePrompt: string,
  finalPrompt: string,
): Promise<string> {
  const fullPrompt = [scenePrompt, finalPrompt, "professional fashion photography, high quality"]
    .filter(Boolean)
    .join(", ");
  console.log(`[Pipeline] Replacing background: "${fullPrompt}"`);
  const output = await runWithRetry(() =>
    replicate.run(INPAINT_MODEL, {
      input: {
        image: imageDataUri,
        mask: maskDataUri,
        prompt: fullPrompt,
        guidance_scale: 3.5,
        num_inference_steps: 28,
        output_format: "png",
      },
    })
  );
  console.log("[Pipeline] Background replaced");
  return output as unknown as string;
}

export async function inpaintWithReference(
  imageDataUri: string,
  referenceDataUri: string,
  prompt: string,
): Promise<string> {
  const fullPrompt = [
    `The image from @image1 but fix the highlighted area to exactly match`,
    `the clothing details, seams, textures, and colors from @image2.`,
    prompt,
    "preserve everything else unchanged, high quality, sharp detail",
  ].join(" ");

  console.log(`[Inpaint+Ref] FLUX.2 Pro Edit — "${fullPrompt.slice(0, 120)}..."`);
  const result = await runWithRetry(() =>
    fal.subscribe("fal-ai/flux-2-pro/edit", {
      input: {
        image_urls: [imageDataUri, referenceDataUri],
        prompt: fullPrompt,
      },
    })
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any;
  const url = r?.data?.images?.[0]?.url ?? r?.images?.[0]?.url ?? r?.data?.image?.url ?? r?.image?.url;
  if (!url) {
    console.error("[Inpaint+Ref] Unexpected response:", JSON.stringify(r).slice(0, 500));
    throw new Error("FLUX.2 Pro Edit (inpaint ref) returned no image URL");
  }
  console.log("[Inpaint+Ref] Done");
  return url;
}

export async function inpaintRegion(
  imageDataUri: string,
  maskDataUri: string,
  prompt: string,
): Promise<string> {
  const fullPrompt = [
    prompt,
    "seamlessly blended with surrounding area, matching lighting and style,",
    "high quality, sharp detail, photorealistic",
  ].join(", ");
  console.log(`[Inpaint] Region: "${fullPrompt}"`);
  const output = await runWithRetry(() =>
    replicate.run(INPAINT_MODEL, {
      input: {
        image: imageDataUri,
        mask: maskDataUri,
        prompt: fullPrompt,
        guidance_scale: 7,
        num_inference_steps: 35,
        output_format: "png",
      },
    })
  );
  console.log("[Inpaint] Region regenerated");
  return output as unknown as string;
}

export async function upscaleImage(imageDataUri: string): Promise<string> {
  console.log("[Pipeline] Upscaling...");
  const output = await runWithRetry(() =>
    replicate.run(UPSCALE_MODEL, {
      input: { image: imageDataUri, scale: 2, face_enhance: true },
    })
  );
  console.log("[Pipeline] Upscale done");
  return output as unknown as string;
}
