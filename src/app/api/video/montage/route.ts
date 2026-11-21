import { NextResponse } from "next/server";
import { createMontageReel, type MontagePlan } from "@/lib/video/montage";
import { apiError, loadCharacter } from "@/lib/api";

export const maxDuration = 600;

/** Montaj planından videoyu oluşturur (birkaç saniye - 1 dakika sürer). */
export async function POST(req: Request) {
  try {
    const { characterId, topic, plan } = (await req.json()) as { characterId: string; topic: string; plan: MontagePlan };
    const c = await loadCharacter(characterId);
    if (!c) return apiError("Karakter bulunamadı", 404);
    const reel = await createMontageReel(c.id, String(topic || ""), plan);
    if (reel.status === "failed") return apiError(reel.error || "Montaj oluşturulamadı");
    return NextResponse.json({ id: reel.id, videoUrl: reel.videoUrl });
  } catch (e) {
    return apiError(e);
  }
}
