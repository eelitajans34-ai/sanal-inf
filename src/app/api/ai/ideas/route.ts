import { NextResponse } from "next/server";
import { generateIdeas } from "@/lib/ai/text";
import { apiError, loadCharacter } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const { characterId, theme, count } = await req.json();
    const c = await loadCharacter(characterId);
    if (!c) return apiError("Karakter bulunamadı", 404);
    const ideas = await generateIdeas(c, Math.min(Number(count) || 5, 10), String(theme || ""));
    return NextResponse.json({ ideas });
  } catch (e) {
    return apiError(e);
  }
}
