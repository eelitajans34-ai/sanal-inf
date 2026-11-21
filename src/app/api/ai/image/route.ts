import { NextResponse } from "next/server";
import { generateImage, type ImageMode } from "@/lib/ai/image";
import { persistRemoteImage } from "@/lib/media";
import { apiError, loadCharacter } from "@/lib/api";

export const maxDuration = 180;

const MODES: ImageMode[] = ["lora", "reference", "text"];

export async function POST(req: Request) {
  try {
    const { characterId, scene, mode } = await req.json();
    const c = await loadCharacter(characterId);
    if (!c) return apiError("Karakter bulunamadı", 404);
    if (!scene) return apiError("Sahne tarifi gerekli", 400);
    const m = MODES.includes(mode) ? (mode as ImageMode) : undefined;
    if (m === "lora" && !c.loraVersion) return apiError("Bu karakterin eğitilmiş modeli yok", 400);
    const url = await generateImage(c, String(scene), { mode: m });
    return NextResponse.json({ imageUrl: await persistRemoteImage(url) });
  } catch (e) {
    return apiError(e);
  }
}
