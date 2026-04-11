import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db, UPLOADS_DIR, RESULTS_DIR } from "@/lib/db";
import { generations } from "@/lib/db/schema";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const MODEL = "cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985";

async function runTryOn(
  humanImg: string,
  garmImg: string,
  category: string,
  prompt: string,
  steps: number,
  seed: number,
  crop: boolean
): Promise<string> {
  console.log(`[TryOn] Starting pass: category=${category}, steps=${steps}, seed=${seed}`);

  const output = await replicate.run(MODEL, {
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
  console.log(`[TryOn] Pass complete: ${category} -> ${url.substring(0, 80)}...`);
  return url;
}

async function imageUrlToDataUri(url: string): Promise<string> {
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:image/png;base64,${buffer.toString("base64")}`;
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

    let finalImageUrl: string;

    if (category === "full_outfit") {
      // Pass 1: upper body
      console.log("[TryOn] Full outfit mode — starting pass 1 (upper body)");
      const upperUrl = await runTryOn(
        modelDataUri, garmentDataUri, "upper_body", prompt, steps, seed, crop
      );

      // Convert intermediate result to data URI for pass 2
      const intermediateDataUri = await imageUrlToDataUri(upperUrl);

      // Pass 2: lower body on the result of pass 1
      console.log("[TryOn] Full outfit mode — starting pass 2 (lower body)");
      finalImageUrl = await runTryOn(
        intermediateDataUri, garmentDataUri, "lower_body", prompt, steps, seed, false
      );
    } else {
      finalImageUrl = await runTryOn(
        modelDataUri, garmentDataUri, category, prompt, steps, seed, crop
      );
    }

    // Download and save final result
    const response = await fetch(finalImageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const resultFilename = `result_${Date.now()}.png`;
    await writeFile(path.join(RESULTS_DIR, resultFilename), Buffer.from(arrayBuffer));

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
