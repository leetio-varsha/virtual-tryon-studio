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
  console.log(`[FASHN v1.6] category=${category}`);
  const result = await runWithRetry(() =>
    fal.subscribe("fal-ai/fashn/tryon/v1.6", {
      input: {
        model_image: input.humanImage,
        garment_image: input.garmentImage,
        category,
      },
    })
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result as any).image.url;
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
        guidance_scale: 2.5,
        ...(input.seed != null ? { seed: input.seed } : {}),
      },
    })
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result as any).image.url;
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
