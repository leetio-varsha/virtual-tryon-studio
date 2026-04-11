import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db, UPLOADS_DIR, RESULTS_DIR } from "@/lib/db";
import { generations } from "@/lib/db/schema";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const MODEL = "cuuupid/idm-vton:c871bb9b046c1b1fceddba3ccc8c6faa1f4afb2d26c86ccea60cabee7ee4e072";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { modelImage, garmentImage, settings } = body;

  if (!modelImage || !garmentImage) {
    return NextResponse.json({ error: "Model and garment images required" }, { status: 400 });
  }

  try {
    // Read images from disk and convert to base64 data URIs
    const modelFilename = path.basename(modelImage);
    const garmentFilename = path.basename(garmentImage);

    const modelBuffer = await readFile(path.join(UPLOADS_DIR, modelFilename));
    const garmentBuffer = await readFile(path.join(UPLOADS_DIR, garmentFilename));

    const modelDataUri = `data:image/jpeg;base64,${modelBuffer.toString("base64")}`;
    const garmentDataUri = `data:image/jpeg;base64,${garmentBuffer.toString("base64")}`;

    const output = await replicate.run(MODEL, {
      input: {
        human_img: modelDataUri,
        garm_img: garmentDataUri,
        garment_des: settings?.prompt || "clothing item",
        category: settings?.category || "upper_body",
        num_inference_steps: settings?.steps || 30,
        guidance_scale: settings?.guidanceScale || 2.0,
        seed: settings?.seed ?? -1,
      },
    });

    // Download result image
    const imageUrl = output as unknown as string;
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const resultFilename = `result_${Date.now()}.png`;
    const resultPath = path.join(RESULTS_DIR, resultFilename);
    await writeFile(resultPath, Buffer.from(arrayBuffer));

    const resultUrl = `/api/files/${resultFilename}`;

    // Save to DB
    await db.insert(generations).values({
      modelImagePath: modelImage,
      garmentImagePath: garmentImage,
      settings: JSON.stringify(settings || {}),
      resultImagePath: resultUrl,
      templateId: body.templateId || null,
    });

    return NextResponse.json({ resultUrl });
  } catch (error) {
    console.error("Try-on error:", error);
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
