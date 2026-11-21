import { NextResponse } from "next/server";
import { generateImage } from "@/lib/ai/image";
import { persistRemoteImage } from "@/lib/media";
import { apiError, loadCharacter } from "@/lib/api";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { characterId, scene } = await req.json();
    const c = await loadCharacter(characterId);
    if (!c) return apiError("Karakter bulunamadı", 404);
    if (!scene) return apiError("Sahne tarifi gerekli", 400);
    const url = await generateImage(c, String(scene));
    return NextResponse.json({ imageUrl: await persistRemoteImage(url) });
  } catch (e) {
    return apiError(e);
  }
}
