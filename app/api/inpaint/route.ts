import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db, RESULTS_DIR, UPLOADS_DIR } from "@/lib/db";
import { generations } from "@/lib/db/schema";
import { inpaintRegion, inpaintWithReference } from "@/lib/providers";
import type { InpaintModel } from "@/lib/providers";

async function readImageFromStorage(filename: string): Promise<Buffer> {
  const safeName = path.basename(filename);
  for (const dir of [RESULTS_DIR, UPLOADS_DIR]) {
    try {
      return await readFile(path.join(dir, safeName));
    } catch {
      continue;
    }
  }
  throw new Error(`Image not found: ${safeName}`);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { imagePath, maskDataUri, prompt, referenceDataUri, inpaintModel } = body as {
    imagePath?: string;
    maskDataUri?: string;
    prompt?: string;
    referenceDataUri?: string;
    inpaintModel?: InpaintModel;
  };

  if (!imagePath || !maskDataUri || !prompt?.trim()) {
    return NextResponse.json(
      { error: "imagePath, maskDataUri and prompt are required" },
      { status: 400 },
    );
  }

  try {
    // Load the base image from storage (results or uploads)
    const imageBuffer = await readImageFromStorage(imagePath);
    const imageDataUri = `data:image/png;base64,${imageBuffer.toString("base64")}`;

    let resultUrl: string;

    if (referenceDataUri) {
      // Reference-guided: FLUX.2 Pro Edit (sees original + reference), then composite with mask
      console.log("[Inpaint] Using reference-guided mode");
      const editedUrl = await inpaintWithReference(imageDataUri, referenceDataUri, prompt, inpaintModel || "flux-edit");

      // Composite: only take the masked region from FLUX.2 result, keep rest from original
      const editedRes = await fetch(editedUrl);
      const editedBuffer = Buffer.from(await editedRes.arrayBuffer());

      // Decode mask from data URI
      const maskBase64 = maskDataUri.replace(/^data:image\/\w+;base64,/, "");
      const maskBuffer = Buffer.from(maskBase64, "base64");

      const { compositeWithMask } = await import("@/lib/image-utils");
      const composited = await compositeWithMask(imageBuffer, editedBuffer, maskBuffer);

      // Save composited result and serve
      const compFilename = `result_${Date.now()}.png`;
      await writeFile(path.join(RESULTS_DIR, compFilename), composited);
      resultUrl = `/api/files/${compFilename}`;
      console.log(`[Inpaint+Ref] Composited: ${resultUrl}`);
    } else {
      // Standard text-only inpainting
      resultUrl = await inpaintRegion(imageDataUri, maskDataUri, prompt);
    }

    // For reference mode, result is already saved locally.
    // For standard mode, fetch remote URL and save locally.
    let savedUrl = resultUrl;
    if (!referenceDataUri) {
      const response = await fetch(resultUrl);
      const resultBuffer = Buffer.from(await response.arrayBuffer());
      const resultFilename = `result_${Date.now()}.png`;
      await writeFile(path.join(RESULTS_DIR, resultFilename), resultBuffer);
      savedUrl = `/api/files/${resultFilename}`;
    }

    await db.insert(generations).values({
      modelImagePath: imagePath,
      garmentImagePath: imagePath,
      settings: JSON.stringify({ inpaint: true, prompt, hasReference: !!referenceDataUri, inpaintModel: inpaintModel || "flux-fill-pro" }),
      resultImagePath: savedUrl,
      templateId: null,
    });

    console.log(`[Inpaint] Done: ${savedUrl}`);
    return NextResponse.json({ resultUrl: savedUrl });
  } catch (error) {
    console.error("[Inpaint] Error:", error);
    const message = error instanceof Error ? error.message : "Inpaint failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
