import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db, RESULTS_DIR, UPLOADS_DIR } from "@/lib/db";
import { generations } from "@/lib/db/schema";
import { inpaintRegion } from "@/lib/providers";

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
  const { imagePath, maskDataUri, prompt } = body as {
    imagePath?: string;
    maskDataUri?: string;
    prompt?: string;
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

    const resultUrl = await inpaintRegion(imageDataUri, maskDataUri, prompt);

    // Fetch result and save locally so we keep full history under /api/files/
    const response = await fetch(resultUrl);
    const resultBuffer = Buffer.from(await response.arrayBuffer());
    const resultFilename = `result_${Date.now()}.png`;
    await writeFile(path.join(RESULTS_DIR, resultFilename), resultBuffer);
    const savedUrl = `/api/files/${resultFilename}`;

    await db.insert(generations).values({
      modelImagePath: imagePath,
      garmentImagePath: imagePath,
      settings: JSON.stringify({ inpaint: true, prompt }),
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
