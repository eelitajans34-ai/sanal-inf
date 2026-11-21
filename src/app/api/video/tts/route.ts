import { NextResponse } from "next/server";
import { speak } from "@/lib/video/voice";
import { apiError, loadCharacter } from "@/lib/api";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { characterId, text } = await req.json();
    const c = await loadCharacter(characterId);
    if (!c) return apiError("Karakter bulunamadı", 404);
    const t = String(text || "").trim();
    if (!t) return apiError("Metin gerekli", 400);
    return NextResponse.json({ audioUrl: await speak(c, t.slice(0, 600)) });
  } catch (e) {
    return apiError(e);
  }
}
