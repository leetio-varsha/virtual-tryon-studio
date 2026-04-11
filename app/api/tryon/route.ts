import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db, UPLOADS_DIR, RESULTS_DIR } from "@/lib/db";
import { generations } from "@/lib/db/schema";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const TRYON_MODEL = "cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985";
const BG_REMOVE_MODEL = "lucataco/remove-bg:95fcc2a26d3899cd6c2691c900571aeaa540f23e4f1f553e2eb6704cfbb2674b";
const INPAINT_MODEL = "black-forest-labs/flux-fill-pro";

async function runTryOn(
  humanImg: string,
  garmImg: string,
  category: string,
  prompt: string,
  steps: number,
  seed: number,
  crop: boolean
): Promise<string> {
  console.log(`[TryOn] Pass: category=${category}, steps=${steps}`);
  const output = await replicate.run(TRYON_MODEL, {
    input: {
      human_img: humanImg,
      garm_img: garmImg,
      garment_des: prompt || "clothing item",
      category,
      steps,
      seed,
      crop,
    },
  });
  const url = output as unknown as string;
  console.log(`[TryOn] Pass done: ${category}`);
  return url;
}

async function fetchAsDataUri(url: string, mime = "image/png"): Promise<string> {
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function fetchAsBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

async function removeBackground(imageDataUri: string): Promise<string> {
  console.log("[TryOn] Removing background...");
  const output = await replicate.run(BG_REMOVE_MODEL, {
    input: { image: imageDataUri },
  });
  // Returns URL to PNG with transparency
  const url = output as unknown as string;
  console.log("[TryOn] Background removed");
  return url;
}

async function replaceBackground(
  imageDataUri: string,
  maskDataUri: string,
  scenePrompt: string,
  finalPrompt: string,
): Promise<string> {
  const fullPrompt = [
    scenePrompt,
    finalPrompt,
    "professional fashion photography, high quality",
  ].filter(Boolean).join(", ");

  console.log(`[TryOn] Replacing background: "${fullPrompt}"`);

  const output = await replicate.run(INPAINT_MODEL, {
    input: {
      image: imageDataUri,
      mask: maskDataUri,
      prompt: fullPrompt,
      guidance_scale: 3.5,
      num_inference_steps: 28,
      output_format: "png",
    },
  });

  const url = output as unknown as string;
  console.log("[TryOn] Background replaced");
  return url;
}

async function createBackgroundMask(imageDataUri: string): Promise<string> {
  // Remove background to get transparent PNG
  const transparentUrl = await removeBackground(imageDataUri);
  const transparentBuffer = await fetchAsBuffer(transparentUrl);

  // We need to create an inverted mask: white = background (to replace), black = person (to keep)
  // For flux-fill-pro: white areas get inpainted
  // Simple approach: use the alpha channel from remove-bg result
  // Since we can't do image processing without sharp, we'll use a different approach:
  // Send the original image + the transparent cutout as mask reference

  // Actually flux-fill-pro expects: image + mask where white = area to regenerate
  // The remove-bg output has transparent background = that's our area to regenerate
  // We need to convert: transparent -> white, person -> black

  // Without sharp we can use canvas on server... but simpler:
  // Just return the transparent image URL — we'll handle mask creation differently

  return transparentUrl;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { modelImage, garmentImage, settings } = body;

  if (!modelImage || !garmentImage) {
    return NextResponse.json({ error: "Model and garment images required" }, { status: 400 });
  }

  try {
    const modelFilename = path.basename(modelImage);
    const garmentFilename = path.basename(garmentImage);

    const modelBuffer = await readFile(path.join(UPLOADS_DIR, modelFilename));
    const garmentBuffer = await readFile(path.join(UPLOADS_DIR, garmentFilename));

    const modelDataUri = `data:image/jpeg;base64,${modelBuffer.toString("base64")}`;
    const garmentDataUri = `data:image/jpeg;base64,${garmentBuffer.toString("base64")}`;

    const steps = settings?.steps || 30;
    const seed = settings?.seed ?? 42;
    const crop = settings?.crop ?? true;
    const prompt = settings?.prompt || "clothing item";
    const category = settings?.category || "upper_body";
    const scenePrompt = settings?.scenePrompt || "";

    // Step 1: Virtual try-on
    let tryonResultUrl: string;

    if (category === "full_outfit") {
      console.log("[TryOn] Full outfit — pass 1 (upper body)");
      const upperUrl = await runTryOn(
        modelDataUri, garmentDataUri, "upper_body", prompt, steps, seed, crop
      );
      const intermediateDataUri = await fetchAsDataUri(upperUrl);

      console.log("[TryOn] Full outfit — pass 2 (lower body)");
      tryonResultUrl = await runTryOn(
        intermediateDataUri, garmentDataUri, "lower_body", prompt, steps, seed, false
      );
    } else {
      tryonResultUrl = await runTryOn(
        modelDataUri, garmentDataUri, category, prompt, steps, seed, crop
      );
    }

    let finalImageUrl = tryonResultUrl;

    // Step 2: Background replacement (if scene or final prompt provided)
    const finalPromptSetting = settings?.finalPrompt || "";
    if (scenePrompt.trim() || finalPromptSetting.trim()) {
      const tryonDataUri = await fetchAsDataUri(tryonResultUrl);

      // Get transparent PNG (person only) to create mask
      const transparentUrl = await removeBackground(tryonDataUri);
      const transparentBuffer = await fetchAsBuffer(transparentUrl);

      // Create mask: we need to extract alpha channel and invert it
      // Using canvas-free approach: create a simple mask from the transparent image
      // For flux-fill-pro, we need white=replace, black=keep
      // We'll create the mask by analyzing alpha channel of the transparent PNG

      const { createInvertedMaskFromAlpha } = await import("@/lib/image-utils");
      const tryonBuffer = await fetchAsBuffer(tryonResultUrl);
      const maskBuffer = await createInvertedMaskFromAlpha(transparentBuffer);
      const maskDataUri = `data:image/png;base64,${maskBuffer.toString("base64")}`;

      const finalPrompt = settings?.finalPrompt || "";
      finalImageUrl = await replaceBackground(tryonDataUri, maskDataUri, scenePrompt, finalPrompt);
    }

    // Download and crop to aspect ratio
    const response = await fetch(finalImageUrl);
    let resultBuffer: Buffer = Buffer.from(await response.arrayBuffer());

    // Crop to Instagram aspect ratio
    const aspectRatio = settings?.aspectRatio || "4:5";
    if (aspectRatio !== "4:5" || scenePrompt.trim()) {
      const { cropToAspectRatio } = await import("@/lib/image-utils");
      resultBuffer = await cropToAspectRatio(resultBuffer, aspectRatio) as Buffer;
      console.log(`[TryOn] Cropped to ${aspectRatio}`);
    }

    const resultFilename = `result_${Date.now()}.png`;
    await writeFile(path.join(RESULTS_DIR, resultFilename), resultBuffer);

    const resultUrl = `/api/files/${resultFilename}`;

    await db.insert(generations).values({
      modelImagePath: modelImage,
      garmentImagePath: garmentImage,
      settings: JSON.stringify(settings || {}),
      resultImagePath: resultUrl,
      templateId: body.templateId || null,
    });

    console.log(`[TryOn] Done: ${resultUrl}`);
    return NextResponse.json({ resultUrl });
  } catch (error) {
    console.error("[TryOn] Error:", error);
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
