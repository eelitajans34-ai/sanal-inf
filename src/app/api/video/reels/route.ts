import { NextResponse } from "next/server";
import { createReel } from "@/lib/video/reels";
import { apiError, loadCharacter } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const { characterId, topic, plan } = await req.json();
    const c = await loadCharacter(characterId);
    if (!c) return apiError("Karakter bulunamadı", 404);
    const reel = await createReel(c.id, String(topic || ""), plan);
    return NextResponse.json({ id: reel.id });
  } catch (e) {
    return apiError(e);
  }
}
