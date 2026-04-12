import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db, UPLOADS_DIR, RESULTS_DIR } from "@/lib/db";
import { generations } from "@/lib/db/schema";
import type { AiModel } from "@/lib/db/schema";
import {
  runTryOn,
  runPhotoshoot,
  runGrokPhotoshoot,
  runGeminiPhotoshoot,
  runGptImagePhotoshoot,
  fixFaceWithGemini,
  runHybridEnhance,
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
  const { modelImage, garmentImage, garmentImageBottom, settings } = body;

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
    const seed = settings?.seed ?? null;
    const aspectRatio = settings?.aspectRatio || "4:5";

    // ═══ FLUX.2 Photoshoot — separate pipeline ═══
    if (aiModel === "flux-photoshoot") {
      const scenePrompt = settings?.scenePrompt || "professional studio, clean background";
      const finalPrompt = settings?.finalPrompt || "professional fashion photography, sharp details, 4K";

      let resultUrl = await runPhotoshoot({
        modelImage: modelDataUri,
        garmentImage: garmentDataUri,
        scenePrompt,
        finalPrompt,
        aspectRatio,
        seed,
      });

      // Optional face swap
      if (settings?.faceSwap === true && settings?.faceImagePath) {
        try {
          const faceFilename = path.basename(settings.faceImagePath);
          const faceBuffer = await readFile(path.join(UPLOADS_DIR, faceFilename));
          const faceDataUri = `data:image/jpeg;base64,${faceBuffer.toString("base64")}`;
          const resultDataUri = await fetchAsDataUri(resultUrl);
          resultUrl = await swapFace(faceDataUri, resultDataUri);
          console.log("[Photoshoot] Face swap applied");
        } catch (e) {
          console.error("[Photoshoot] Face swap failed, keeping original:", e);
        }
      }

      // Optional upscale
      if (settings?.hdUpscale !== false) {
        const upscaleDataUri = await fetchAsDataUri(resultUrl);
        resultUrl = await upscaleImage(upscaleDataUri);
      }

      // Download and save
      const response = await fetch(resultUrl);
      const resultBuffer: Buffer = Buffer.from(await response.arrayBuffer());
      const resultFilename = `result_${Date.now()}.png`;
      await writeFile(path.join(RESULTS_DIR, resultFilename), resultBuffer);
      const savedUrl = `/api/files/${resultFilename}`;

      await db.insert(generations).values({
        modelImagePath: modelImage,
        garmentImagePath: garmentImage,
        settings: JSON.stringify(settings || {}),
        resultImagePath: savedUrl,
        templateId: body.templateId || null,
      });

      console.log(`[Photoshoot] Done: ${savedUrl}`);
      return NextResponse.json({ resultUrl: savedUrl });
    }

    // ═══ Grok Imagine Photoshoot — fast & cheap ═══
    if (aiModel === "grok-photoshoot") {
      const scenePrompt = settings?.scenePrompt || "professional studio, clean background";
      const finalPrompt = settings?.finalPrompt || "professional fashion photography, sharp details, 4K";

      let resultUrl = await runGrokPhotoshoot({
        modelImage: modelDataUri,
        garmentImage: garmentDataUri,
        scenePrompt,
        finalPrompt,
        aspectRatio,
        seed,
      });

      // Optional face swap
      if (settings?.faceSwap === true && settings?.faceImagePath) {
        try {
          const faceFilename = path.basename(settings.faceImagePath);
          const faceBuffer = await readFile(path.join(UPLOADS_DIR, faceFilename));
          const faceDataUri = `data:image/jpeg;base64,${faceBuffer.toString("base64")}`;
          const resultDataUri = await fetchAsDataUri(resultUrl);
          resultUrl = await swapFace(faceDataUri, resultDataUri);
          console.log("[Grok] Face swap applied");
        } catch (e) {
          console.error("[Grok] Face swap failed, keeping original:", e);
        }
      }

      // Optional upscale
      if (settings?.hdUpscale !== false) {
        const upscaleDataUri = await fetchAsDataUri(resultUrl);
        resultUrl = await upscaleImage(upscaleDataUri);
      }

      // Download and save
      const response = await fetch(resultUrl);
      const resultBuffer: Buffer = Buffer.from(await response.arrayBuffer());
      const resultFilename = `result_${Date.now()}.png`;
      await writeFile(path.join(RESULTS_DIR, resultFilename), resultBuffer);
      const savedUrl = `/api/files/${resultFilename}`;

      await db.insert(generations).values({
        modelImagePath: modelImage,
        garmentImagePath: garmentImage,
        settings: JSON.stringify(settings || {}),
        resultImagePath: savedUrl,
        templateId: body.templateId || null,
      });

      console.log(`[Grok] Done: ${savedUrl}`);
      return NextResponse.json({ resultUrl: savedUrl });
    }

    // ═══ Gemini 3 Pro Photoshoot — strong face reference ═══
    if (aiModel === "gemini-photoshoot") {
      const scenePrompt = settings?.scenePrompt || "professional studio, clean background";
      const finalPrompt = settings?.finalPrompt || "professional fashion photography, sharp details, 4K";

      let resultUrl = await runGeminiPhotoshoot({
        modelImage: modelDataUri,
        garmentImage: garmentDataUri,
        scenePrompt,
        finalPrompt,
        aspectRatio,
        seed,
      });

      // Optional face swap
      if (settings?.faceSwap === true && settings?.faceImagePath) {
        try {
          const faceFilename = path.basename(settings.faceImagePath);
          const faceBuffer = await readFile(path.join(UPLOADS_DIR, faceFilename));
          const faceDataUri = `data:image/jpeg;base64,${faceBuffer.toString("base64")}`;
          const resultDataUri = await fetchAsDataUri(resultUrl);
          resultUrl = await swapFace(faceDataUri, resultDataUri);
          console.log("[Gemini] Face swap applied");
        } catch (e) {
          console.error("[Gemini] Face swap failed, keeping original:", e);
        }
      }

      // Optional upscale
      if (settings?.hdUpscale !== false) {
        const upscaleDataUri = await fetchAsDataUri(resultUrl);
        resultUrl = await upscaleImage(upscaleDataUri);
      }

      // Download and save
      const response = await fetch(resultUrl);
      const resultBuffer: Buffer = Buffer.from(await response.arrayBuffer());
      const resultFilename = `result_${Date.now()}.png`;
      await writeFile(path.join(RESULTS_DIR, resultFilename), resultBuffer);
      const savedUrl = `/api/files/${resultFilename}`;

      await db.insert(generations).values({
        modelImagePath: modelImage,
        garmentImagePath: garmentImage,
        settings: JSON.stringify(settings || {}),
        resultImagePath: savedUrl,
        templateId: body.templateId || null,
      });

      console.log(`[Gemini] Done: ${savedUrl}`);
      return NextResponse.json({ resultUrl: savedUrl });
    }

    // ═══ GPT Image 1.5 Photoshoot — max quality ═══
    if (aiModel === "gpt-image-photoshoot") {
      const scenePrompt = settings?.scenePrompt || "professional studio, clean background";
      const finalPrompt = settings?.finalPrompt || "professional fashion photography, sharp details, 4K";

      let resultUrl = await runGptImagePhotoshoot({
        modelImage: modelDataUri,
        garmentImage: garmentDataUri,
        scenePrompt,
        finalPrompt,
        aspectRatio,
        seed,
      });

      // Optional face swap
      if (settings?.faceSwap === true && settings?.faceImagePath) {
        try {
          const faceFilename = path.basename(settings.faceImagePath);
          const faceBuffer = await readFile(path.join(UPLOADS_DIR, faceFilename));
          const faceDataUri = `data:image/jpeg;base64,${faceBuffer.toString("base64")}`;
          const resultDataUri = await fetchAsDataUri(resultUrl);
          resultUrl = await swapFace(faceDataUri, resultDataUri);
          console.log("[GPT-Image] Face swap applied");
        } catch (e) {
          console.error("[GPT-Image] Face swap failed, keeping original:", e);
        }
      }

      // Optional upscale
      if (settings?.hdUpscale !== false) {
        const upscaleDataUri = await fetchAsDataUri(resultUrl);
        resultUrl = await upscaleImage(upscaleDataUri);
      }

      // Download and save
      const response = await fetch(resultUrl);
      const resultBuffer: Buffer = Buffer.from(await response.arrayBuffer());
      const resultFilename = `result_${Date.now()}.png`;
      await writeFile(path.join(RESULTS_DIR, resultFilename), resultBuffer);
      const savedUrl = `/api/files/${resultFilename}`;

      await db.insert(generations).values({
        modelImagePath: modelImage,
        garmentImagePath: garmentImage,
        settings: JSON.stringify(settings || {}),
        resultImagePath: savedUrl,
        templateId: body.templateId || null,
      });

      console.log(`[GPT-Image] Done: ${savedUrl}`);
      return NextResponse.json({ resultUrl: savedUrl });
    }

    // ═══ Hybrid v2: FASHN → Grok → Gemini (face) ═══
    if (aiModel === "hybrid-v2") {
      const steps = settings?.steps || 30;
      const crop = settings?.crop ?? true;
      const prompt = settings?.prompt || "clothing item";
      const category = settings?.category || "upper_body";
      const fashnMode = settings?.fashnMode || "quality";
      const garmentPhotoType = settings?.garmentPhotoType || "auto";
      const scenePrompt = settings?.scenePrompt || "professional studio, clean background";
      const finalPrompt = settings?.finalPrompt || "professional fashion photography, sharp details, 4K";

      // Step 1: FASHN try-on for precise clothing
      let fashnResultUrl: string;

      if (category === "full_outfit") {
        if (!garmentImageBottom) {
          return NextResponse.json(
            { error: "Full outfit requires two garments: top and bottom" },
            { status: 400 },
          );
        }
        const bottomFilename = path.basename(garmentImageBottom);
        const bottomBuffer = await readFile(path.join(UPLOADS_DIR, bottomFilename));
        const bottomDataUri = `data:image/jpeg;base64,${bottomBuffer.toString("base64")}`;

        console.log("[Hybrid-v2] Step 1a: FASHN upper body");
        const upperUrl = await runTryOn("fashn-v1.6", {
          humanImage: modelDataUri,
          garmentImage: garmentDataUri,
          category: "upper_body",
          prompt, steps, seed, crop, fashnMode, garmentPhotoType, guidanceScale: 2.5,
        });
        const intermediateDataUri = await fetchAsDataUri(upperUrl);

        console.log("[Hybrid-v2] Step 1b: FASHN lower body");
        fashnResultUrl = await runTryOn("fashn-v1.6", {
          humanImage: intermediateDataUri,
          garmentImage: bottomDataUri,
          category: "lower_body",
          prompt, steps, seed, crop: false, fashnMode, garmentPhotoType, guidanceScale: 2.5,
        });
      } else {
        console.log(`[Hybrid-v2] Step 1: FASHN try-on (${category})`);
        fashnResultUrl = await runTryOn("fashn-v1.6", {
          humanImage: modelDataUri,
          garmentImage: garmentDataUri,
          category, prompt, steps, seed, crop, fashnMode, garmentPhotoType, guidanceScale: 2.5,
        });
      }

      // Step 2: Grok scene enhancement (fast, $0.02)
      console.log("[Hybrid-v2] Step 2: Grok scene enhancement");
      const fashnDataUri = await fetchAsDataUri(fashnResultUrl);
      let resultUrl = await runGrokPhotoshoot({
        modelImage: fashnDataUri,
        garmentImage: garmentDataUri,
        scenePrompt,
        finalPrompt,
        aspectRatio,
        seed,
      });

      // Step 3: Gemini face fix (if face reference provided)
      if (settings?.faceSwap === true && settings?.faceImagePath) {
        try {
          const faceFilename = path.basename(settings.faceImagePath);
          const faceBuffer = await readFile(path.join(UPLOADS_DIR, faceFilename));
          const faceDataUri = `data:image/jpeg;base64,${faceBuffer.toString("base64")}`;
          const resultDataUri = await fetchAsDataUri(resultUrl);
          resultUrl = await fixFaceWithGemini(resultDataUri, faceDataUri);
          console.log("[Hybrid-v2] Step 3: Gemini face fix applied");
        } catch (e) {
          console.error("[Hybrid-v2] Face fix failed, keeping original:", e);
        }
      }

      // Step 4: Optional upscale
      if (settings?.hdUpscale !== false) {
        const upscaleDataUri = await fetchAsDataUri(resultUrl);
        resultUrl = await upscaleImage(upscaleDataUri);
      }

      // Step 5: Download, crop, save
      const response = await fetch(resultUrl);
      let resultBuffer: Buffer = Buffer.from(await response.arrayBuffer());

      const { cropToAspectRatio } = await import("@/lib/image-utils");
      resultBuffer = await cropToAspectRatio(resultBuffer, aspectRatio) as Buffer;
      console.log(`[Hybrid-v2] Cropped to ${aspectRatio}`);

      const resultFilename = `result_${Date.now()}.png`;
      await writeFile(path.join(RESULTS_DIR, resultFilename), resultBuffer);
      const savedUrl = `/api/files/${resultFilename}`;

      await db.insert(generations).values({
        modelImagePath: modelImage,
        garmentImagePath: garmentImage,
        settings: JSON.stringify(settings || {}),
        resultImagePath: savedUrl,
        templateId: body.templateId || null,
      });

      console.log(`[Hybrid-v2] Done: ${savedUrl}`);
      return NextResponse.json({ resultUrl: savedUrl });
    }

    // ═══ Pipeline C: Hybrid FASHN → FLUX.2 Pro Edit ═══
    if (aiModel === "hybrid-fashn-flux") {
      const steps = settings?.steps || 30;
      const crop = settings?.crop ?? true;
      const prompt = settings?.prompt || "clothing item";
      const category = settings?.category || "upper_body";
      const fashnMode = settings?.fashnMode || "quality";
      const garmentPhotoType = settings?.garmentPhotoType || "auto";
      const scenePrompt = settings?.scenePrompt || "professional studio, clean background";
      const finalPrompt = settings?.finalPrompt || "professional fashion photography, sharp details, 4K";

      // Step 1: FASHN try-on for precise clothing
      let fashnResultUrl: string;
      const garmentRefs: string[] = [garmentDataUri];

      if (category === "full_outfit") {
        if (!garmentImageBottom) {
          return NextResponse.json(
            { error: "Full outfit requires two garments: top and bottom" },
            { status: 400 },
          );
        }
        const bottomFilename = path.basename(garmentImageBottom);
        const bottomBuffer = await readFile(path.join(UPLOADS_DIR, bottomFilename));
        const bottomDataUri = `data:image/jpeg;base64,${bottomBuffer.toString("base64")}`;
        garmentRefs.push(bottomDataUri);

        console.log("[Hybrid] Step 1a: FASHN upper body");
        const upperUrl = await runTryOn("fashn-v1.6", {
          humanImage: modelDataUri,
          garmentImage: garmentDataUri,
          category: "upper_body",
          prompt, steps, seed, crop, fashnMode, garmentPhotoType, guidanceScale: 2.5,
        });
        const intermediateDataUri = await fetchAsDataUri(upperUrl);

        console.log("[Hybrid] Step 1b: FASHN lower body");
        fashnResultUrl = await runTryOn("fashn-v1.6", {
          humanImage: intermediateDataUri,
          garmentImage: bottomDataUri,
          category: "lower_body",
          prompt, steps, seed, crop: false, fashnMode, garmentPhotoType, guidanceScale: 2.5,
        });
      } else {
        console.log(`[Hybrid] Step 1: FASHN try-on (${category})`);
        fashnResultUrl = await runTryOn("fashn-v1.6", {
          humanImage: modelDataUri,
          garmentImage: garmentDataUri,
          category, prompt, steps, seed, crop, fashnMode, garmentPhotoType, guidanceScale: 2.5,
        });
      }

      // Step 2: FLUX.2 Pro Edit for photorealistic scene
      console.log("[Hybrid] Step 2: FLUX.2 Pro Edit scene enhancement");
      const fashnDataUri = await fetchAsDataUri(fashnResultUrl);
      let resultUrl = await runHybridEnhance({
        fashnResultImage: fashnDataUri,
        garmentImages: garmentRefs,
        scenePrompt,
        finalPrompt,
        aspectRatio,
        seed,
      });

      // Step 3: Optional face swap
      if (settings?.faceSwap === true && settings?.faceImagePath) {
        try {
          const faceFilename = path.basename(settings.faceImagePath);
          const faceBuffer = await readFile(path.join(UPLOADS_DIR, faceFilename));
          const faceDataUri = `data:image/jpeg;base64,${faceBuffer.toString("base64")}`;
          const resultDataUri = await fetchAsDataUri(resultUrl);
          resultUrl = await swapFace(faceDataUri, resultDataUri);
          console.log("[Hybrid] Face swap applied");
        } catch (e) {
          console.error("[Hybrid] Face swap failed, keeping original:", e);
        }
      }

      // Step 4: Optional upscale
      if (settings?.hdUpscale !== false) {
        const upscaleDataUri = await fetchAsDataUri(resultUrl);
        resultUrl = await upscaleImage(upscaleDataUri);
      }

      // Step 5: Download, crop, and save
      const response = await fetch(resultUrl);
      let resultBuffer: Buffer = Buffer.from(await response.arrayBuffer());

      const { cropToAspectRatio } = await import("@/lib/image-utils");
      resultBuffer = await cropToAspectRatio(resultBuffer, aspectRatio) as Buffer;
      console.log(`[Hybrid] Cropped to ${aspectRatio}`);

      const resultFilename = `result_${Date.now()}.png`;
      await writeFile(path.join(RESULTS_DIR, resultFilename), resultBuffer);
      const savedUrl = `/api/files/${resultFilename}`;

      await db.insert(generations).values({
        modelImagePath: modelImage,
        garmentImagePath: garmentImage,
        settings: JSON.stringify(settings || {}),
        resultImagePath: savedUrl,
        templateId: body.templateId || null,
      });

      console.log(`[Hybrid] Done: ${savedUrl}`);
      return NextResponse.json({ resultUrl: savedUrl });
    }

    // ═══ Try-on pipeline (FASHN / Leffa / IDM-VTON) ═══
    const steps = settings?.steps || 30;
    const crop = settings?.crop ?? true;
    const prompt = settings?.prompt || "clothing item";
    const category = settings?.category || "upper_body";
    const scenePrompt = settings?.scenePrompt || "";
    const fashnMode = settings?.fashnMode || "quality";
    const garmentPhotoType = settings?.garmentPhotoType || "auto";
    const guidanceScale = settings?.guidanceScale ?? 2.5;

    // Step 1: Virtual try-on
    let tryonResultUrl: string;

    if (category === "full_outfit") {
      if (!garmentImageBottom) {
        return NextResponse.json(
          { error: "Full outfit requires two garments: top and bottom" },
          { status: 400 },
        );
      }
      const bottomFilename = path.basename(garmentImageBottom);
      const bottomBuffer = await readFile(path.join(UPLOADS_DIR, bottomFilename));
      const bottomDataUri = `data:image/jpeg;base64,${bottomBuffer.toString("base64")}`;

      console.log(`[TryOn] Full outfit — pass 1 (upper body) [${aiModel}]`);
      const upperUrl = await runTryOn(aiModel, {
        humanImage: modelDataUri,
        garmentImage: garmentDataUri,
        category: "upper_body",
        prompt,
        steps,
        seed,
        crop,
        fashnMode,
        garmentPhotoType,
        guidanceScale,
      });
      const intermediateDataUri = await fetchAsDataUri(upperUrl);

      console.log(`[TryOn] Full outfit — pass 2 (lower body) [${aiModel}]`);
      tryonResultUrl = await runTryOn(aiModel, {
        humanImage: intermediateDataUri,
        garmentImage: bottomDataUri,
        category: "lower_body",
        prompt,
        steps,
        seed,
        crop: false,
        fashnMode,
        garmentPhotoType,
        guidanceScale,
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
        fashnMode,
        garmentPhotoType,
        guidanceScale,
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
