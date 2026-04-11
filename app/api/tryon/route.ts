import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db, UPLOADS_DIR, RESULTS_DIR } from "@/lib/db";
import { generations } from "@/lib/db/schema";
import type { AiModel } from "@/lib/db/schema";
import {
  runTryOn,
  removeBackground,
  replaceBackground,
  upscaleImage,
  swapFace,
} from "@/lib/providers";

async function fetchAsDataUri(url: string, mime = "image/png"): Promise<string> {
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function fetchAsBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
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

    const aiModel: AiModel = settings?.aiModel || "fashn-v1.6";
    const steps = settings?.steps || 30;
    const seed = settings?.seed ?? null;
    const crop = settings?.crop ?? true;
    const prompt = settings?.prompt || "clothing item";
    const category = settings?.category || "upper_body";
    const scenePrompt = settings?.scenePrompt || "";

    // Step 1: Virtual try-on
    let tryonResultUrl: string;

    if (category === "full_outfit") {
      console.log(`[TryOn] Full outfit — pass 1 (upper body) [${aiModel}]`);
      const upperUrl = await runTryOn(aiModel, {
        humanImage: modelDataUri,
        garmentImage: garmentDataUri,
        category: "upper_body",
        prompt,
        steps,
        seed,
        crop,
      });
      const intermediateDataUri = await fetchAsDataUri(upperUrl);

      console.log(`[TryOn] Full outfit — pass 2 (lower body) [${aiModel}]`);
      tryonResultUrl = await runTryOn(aiModel, {
        humanImage: intermediateDataUri,
        garmentImage: garmentDataUri,
        category: "lower_body",
        prompt,
        steps,
        seed,
        crop: false,
      });
    } else {
      tryonResultUrl = await runTryOn(aiModel, {
        humanImage: modelDataUri,
        garmentImage: garmentDataUri,
        category,
        prompt,
        steps,
        seed,
        crop,
      });
    }

    let finalImageUrl = tryonResultUrl;

    // Step 2: Face swap (if enabled and face reference provided)
    const faceSwapEnabled = settings?.faceSwap === true;
    const faceImagePath = settings?.faceImagePath as string | null | undefined;
    if (faceSwapEnabled && faceImagePath) {
      try {
        const faceFilename = path.basename(faceImagePath);
        const faceBuffer = await readFile(path.join(UPLOADS_DIR, faceFilename));
        const faceDataUri = `data:image/jpeg;base64,${faceBuffer.toString("base64")}`;
        const tryonDataUri = await fetchAsDataUri(finalImageUrl);
        finalImageUrl = await swapFace(faceDataUri, tryonDataUri);
        console.log("[TryOn] Face swap applied");
      } catch (e) {
        console.error("[TryOn] Face swap failed, keeping original:", e);
      }
    }

    // Step 3: Background replacement (if scene or final prompt provided)
    const finalPromptSetting = settings?.finalPrompt || "";
    if (scenePrompt.trim() || finalPromptSetting.trim()) {
      const tryonDataUri = await fetchAsDataUri(finalImageUrl);

      const transparentUrl = await removeBackground(tryonDataUri);
      const transparentBuffer = await fetchAsBuffer(transparentUrl);

      const { createInvertedMaskFromAlpha } = await import("@/lib/image-utils");
      const maskBuffer = await createInvertedMaskFromAlpha(transparentBuffer);
      const maskDataUri = `data:image/png;base64,${maskBuffer.toString("base64")}`;

      finalImageUrl = await replaceBackground(tryonDataUri, maskDataUri, scenePrompt, finalPromptSetting);
    }

    // Step 4: Upscale (if enabled)
    let downloadUrl = finalImageUrl;
    if (settings?.hdUpscale !== false) {
      const upscaleDataUri = await fetchAsDataUri(finalImageUrl);
      downloadUrl = await upscaleImage(upscaleDataUri);
    }

    // Step 5: Crop to Instagram aspect ratio
    const response = await fetch(downloadUrl);
    let resultBuffer: Buffer = Buffer.from(await response.arrayBuffer());

    const aspectRatio = settings?.aspectRatio || "4:5";
    if (aspectRatio !== "4:5" || scenePrompt.trim()) {
      const { cropToAspectRatio } = await import("@/lib/image-utils");
      resultBuffer = await cropToAspectRatio(resultBuffer, aspectRatio) as Buffer;
      console.log(`[TryOn] Cropped to ${aspectRatio}`);
    }

    // Save result
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

    console.log(`[TryOn] Done [${aiModel}]: ${resultUrl}`);
    return NextResponse.json({ resultUrl });
  } catch (error) {
    console.error("[TryOn] Error:", error);
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
