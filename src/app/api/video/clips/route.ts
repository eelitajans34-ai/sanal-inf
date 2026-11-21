import { NextResponse } from "next/server";
import { createClip, makeStartImage } from "@/lib/video/clips";
import { presetById } from "@/lib/video/presets";
import { engineById } from "@/lib/video/engines";
import { apiError, loadCharacter } from "@/lib/api";

/** Aynı hareketi seçilen motorlarda (karşılaştırma için) birer klip olarak başlatır. */
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { characterId, presetId, engines, scene, line, startImageUrl } = await req.json();
    const c = await loadCharacter(characterId);
    if (!c) return apiError("Karakter bulunamadı", 404);
    const preset = presetById(String(presetId));
    if (!preset) return apiError("Hareket bulunamadı", 400);
    const list: string[] = (Array.isArray(engines) ? engines : []).filter(
      (e: string) => engineById(e)?.kind === preset.kind
    );
    if (list.length === 0) return apiError("En az bir uygun motor seç", 400);

    // Adil karşılaştırma: tüm motorlar aynı başlangıç karesinden başlar
    const start = startImageUrl ? String(startImageUrl) : await makeStartImage(c, String(scene || ""), preset.kind);

    const ids: string[] = [];
    for (const engine of list.slice(0, 3)) {
      const clip = await createClip({
        characterId: c.id,
        presetId: preset.id,
        kind: preset.kind,
        engine,
        scene: String(scene || ""),
        line: String(line || ""),
        startImageUrl: start,
      });
      ids.push(clip.id);
    }
    return NextResponse.json({ ids });
  } catch (e) {
    return apiError(e);
  }
}
