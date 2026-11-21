import { NextResponse } from "next/server";
import { planReel } from "@/lib/video/reels";
import { apiError, loadCharacter } from "@/lib/api";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { characterId, topic } = await req.json();
    const c = await loadCharacter(characterId);
    if (!c) return apiError("Karakter bulunamadı", 404);
    return NextResponse.json(await planReel(c, String(topic || "")));
  } catch (e) {
    return apiError(e);
  }
}
