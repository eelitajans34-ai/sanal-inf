import { NextResponse } from "next/server";
import { advanceClip } from "@/lib/video/clips";
import { apiError } from "@/lib/api";

export const maxDuration = 300;

/** Klibi bir adım ilerletir ve güncel durumunu döner (istemci periyodik çağırır). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(await advanceClip(id));
  } catch (e) {
    return apiError(e);
  }
}
