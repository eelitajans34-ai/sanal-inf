import { NextResponse } from "next/server";
import { generateCaption } from "@/lib/ai/text";
import { apiError, loadCharacter } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const { characterId, idea } = await req.json();
    const c = await loadCharacter(characterId);
    if (!c) return apiError("Karakter bulunamadı", 404);
    if (!idea) return apiError("Fikir gerekli", 400);
    return NextResponse.json(await generateCaption(c, String(idea)));
  } catch (e) {
    return apiError(e);
  }
}
