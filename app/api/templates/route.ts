import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const all = await db.select().from(templates).orderBy(desc(templates.updatedAt));
  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, modelImagePath, garmentImagePaths, settings, previewPath } = body;

  const result = await db.insert(templates).values({
    name,
    modelImagePath,
    garmentImagePaths: JSON.stringify(garmentImagePaths),
    settings: JSON.stringify(settings),
    previewPath: previewPath || null,
  }).returning();

  return NextResponse.json(result[0]);
}
