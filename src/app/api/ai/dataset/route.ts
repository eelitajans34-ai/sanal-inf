import { NextResponse } from "next/server";
import { generateVariations } from "@/lib/ai/training";
import { apiError, loadCharacter } from "@/lib/api";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { characterId, count } = await req.json();
    const c = await loadCharacter(characterId);
    if (!c) return apiError("Karakter bulunamadı", 404);
    const created = await generateVariations(c, Math.min(Math.max(Number(count) || 4, 1), 6));
    return NextResponse.json({ created: created.length });
  } catch (e) {
    return apiError(e);
  }
}
