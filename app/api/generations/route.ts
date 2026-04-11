import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generations } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const all = await db.select().from(generations).orderBy(desc(generations.createdAt)).limit(50);
  return NextResponse.json(all);
}
