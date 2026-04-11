import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOADS_DIR, RESULTS_DIR } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Prevent directory traversal
  const safeName = path.basename(filename);

  // Try uploads first, then results
  for (const dir of [UPLOADS_DIR, RESULTS_DIR]) {
    const filepath = path.join(dir, safeName);
    try {
      const buffer = await readFile(filepath);
      const ext = path.extname(safeName).toLowerCase();
      const contentType =
        ext === ".png" ? "image/png" :
        ext === ".webp" ? "image/webp" :
        "image/jpeg";
      return new NextResponse(buffer, {
        headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000" },
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
