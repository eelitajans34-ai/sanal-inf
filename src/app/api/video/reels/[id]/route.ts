import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { reelClips, renderReel } from "@/lib/video/reels";
import { apiError } from "@/lib/api";

export const maxDuration = 300;

/** Reels durumunu döner. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const reel = await db.query.reels.findFirst({ where: eq(schema.reels.id, id) });
    if (!reel) return apiError("Bulunamadı", 404);
    return NextResponse.json({ reel, clips: await reelClips(id) });
  } catch (e) {
    return apiError(e);
  }
}

/** Hazır klipleri birleştirir, altyazı ekler. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json({ reel: await renderReel(id) });
  } catch (e) {
    return apiError(e);
  }
}
