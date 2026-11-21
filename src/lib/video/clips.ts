import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Character, Clip } from "@/db/schema";
import { generateImage } from "@/lib/ai/image";
import { replicateEnabled, startPrediction, getPrediction, predictionOutputUrl } from "@/lib/ai/replicate";
import { replicateInput } from "@/lib/ai/inputs";
import { ensureLocalFile, newMediaFile, persistRemoteFile, persistRemoteImage } from "@/lib/media";
import { DEFAULT_ENGINE, engineById } from "./engines";
import { NEGATIVE_PROMPT, buildMotionPrompt, presetById } from "./presets";
import { speak } from "./voice";
import { ffmpeg, mediaDuration } from "./ffmpeg";
import path from "path";
import os from "os";
import { promises as fs } from "fs";

const { clips, characters } = schema;

/** Başlangıç karesi için sahneye eklenen kadraj tarifi. */
function framingFor(kind: "talk" | "action") {
  return kind === "talk"
    ? "vertical smartphone selfie framing, medium close-up from the chest up, looking directly at the camera, face clearly visible, mouth closed in a relaxed smile"
    : "vertical smartphone framing, natural candid pose, face clearly visible";
}

/** Klip için karakterin yüzüyle 9:16 başlangıç karesi üretir (demo: referans fotoğraf). */
export async function makeStartImage(c: Character, scene: string, kind: "talk" | "action") {
  if (!replicateEnabled()) return c.referenceImageUrl || c.avatarUrl;
  const raw = await generateImage(c, `${scene}. ${framingFor(kind)}`, { aspect: "9:16" });
  return persistRemoteImage(raw);
}

export type NewClip = {
  characterId: string;
  kind: "talk" | "action";
  presetId: string;
  engine?: string;
  scene: string;
  line?: string;
  startImageUrl?: string;
  reelId?: string;
  shotIndex?: number;
};

export async function createClip(input: NewClip) {
  const preset = presetById(input.presetId);
  if (!preset) throw new Error(`Bilinmeyen hareket: ${input.presetId}`);
  const kind = preset.kind;
  const engine = input.engine || (await bestEngine(input.characterId, preset.id, kind));
  const e = engineById(engine);
  if (!e || e.kind !== kind) throw new Error(`${engine} motoru bu hareket için uygun değil`);
  if (kind === "talk" && !input.line?.trim()) throw new Error("Konuşma için replik gerekli");

  const [row] = await db
    .insert(clips)
    .values({
      characterId: input.characterId,
      kind,
      presetId: preset.id,
      engine,
      scene: input.scene,
      line: kind === "talk" ? input.line?.trim() || "" : "",
      startImageUrl: input.startImageUrl || "",
      reelId: input.reelId ?? null,
      shotIndex: input.shotIndex ?? null,
      prompt: buildMotionPrompt(preset, input.scene),
    })
    .returning();
  return row;
}

/** Puanlara göre bu hareket için en iyi motoru seçer (yoksa varsayılan). */
export async function bestEngine(characterId: string, presetId: string, kind: "talk" | "action") {
  const rows = await engineStats(characterId, presetId);
  const best = rows.filter((r) => engineById(r.engine)?.kind === kind && r.rated > 0).sort((a, b) => b.score - a.score)[0];
  return best && best.score > 0 ? best.engine : DEFAULT_ENGINE[kind];
}

export async function engineStats(characterId: string, presetId?: string) {
  const rows = await db
    .select({
      presetId: clips.presetId,
      engine: clips.engine,
      total: sql<number>`count(*)`,
      rated: sql<number>`sum(case when ${clips.rating} != 0 then 1 else 0 end)`,
      likes: sql<number>`sum(case when ${clips.rating} = 1 then 1 else 0 end)`,
      dislikes: sql<number>`sum(case when ${clips.rating} = -1 then 1 else 0 end)`,
    })
    .from(clips)
    .where(
      presetId
        ? and(eq(clips.characterId, characterId), eq(clips.presetId, presetId), eq(clips.status, "succeeded"))
        : and(eq(clips.characterId, characterId), eq(clips.status, "succeeded"))
    )
    .groupBy(clips.presetId, clips.engine);
  return rows.map((r) => ({
    ...r,
    rated: Number(r.rated) || 0,
    likes: Number(r.likes) || 0,
    dislikes: Number(r.dislikes) || 0,
    // Beğeni oranı (az örnekte aşırı güveni önlemek için yumuşatılmış)
    score: ((Number(r.likes) || 0) + 1) / ((Number(r.rated) || 0) + 2) - 0.5,
  }));
}

async function update(id: string, data: Partial<Clip>) {
  const [row] = await db.update(clips).set(data).where(eq(clips.id, id)).returning();
  return row;
}

/**
 * Klibi bir sonraki aşamaya taşır. İstemci bunu birkaç saniyede bir çağırır:
 *  preparing → (başlangıç karesi + ses + tahmin başlat) → running → succeeded/failed
 */
export async function advanceClip(id: string): Promise<Clip> {
  const clip = await db.query.clips.findFirst({ where: eq(clips.id, id) });
  if (!clip) throw new Error("Klip bulunamadı");

  if (clip.status === "preparing") {
    // Aynı anda iki istek gelirse yalnızca biri hazırlasın
    const [locked] = await db
      .update(clips)
      .set({ status: "starting" })
      .where(and(eq(clips.id, id), eq(clips.status, "preparing")))
      .returning();
    if (!locked) return (await db.query.clips.findFirst({ where: eq(clips.id, id) }))!;
    try {
      return await prepareAndStart(locked);
    } catch (e) {
      return update(id, { status: "failed", error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (clip.status === "running" && clip.predictionId) {
    try {
      const p = await getPrediction(clip.predictionId);
      if (p.status === "succeeded") {
        const videoUrl = await persistRemoteFile(predictionOutputUrl(p), "mp4");
        return update(id, { status: "succeeded", videoUrl, error: "" });
      }
      if (p.status === "failed" || p.status === "canceled") {
        return update(id, { status: "failed", error: p.error || "Video üretilemedi" });
      }
    } catch (e) {
      return update(id, { error: e instanceof Error ? e.message : String(e) });
    }
  }
  return clip;
}

async function prepareAndStart(clip: Clip): Promise<Clip> {
  const c = await db.query.characters.findFirst({ where: eq(characters.id, clip.characterId) });
  if (!c) throw new Error("Karakter bulunamadı");
  const preset = presetById(clip.presetId)!;
  const engine = engineById(clip.engine)!;

  // 1) Başlangıç karesi (karakterin yüzüyle, 9:16)
  let startImageUrl = clip.startImageUrl;
  if (!startImageUrl) {
    startImageUrl = await makeStartImage(c, clip.scene, clip.kind);
    clip = await update(clip.id, { startImageUrl });
  }

  // 2) Ses (konuşma klipleri)
  let audioUrl = clip.audioUrl;
  if (clip.kind === "talk" && !audioUrl) {
    audioUrl = await speak(c, clip.line);
    clip = await update(clip.id, { audioUrl });
  }

  // 3) Video üretimini başlat
  if (!replicateEnabled()) {
    const videoUrl = await demoClip(c, clip, preset.label);
    return update(clip.id, { status: "succeeded", videoUrl, predictionId: `demo-${clip.id}` });
  }

  const duration = clip.kind === "talk" ? 0 : 5;
  const p = await startPrediction(`/models/${engine.model}/predictions`, {
    input: engine.input({
      image: await replicateInput(startImageUrl),
      audio: audioUrl ? await replicateInput(audioUrl) : undefined,
      prompt: clip.prompt,
      negativePrompt: NEGATIVE_PROMPT,
      duration,
    }),
  });
  return update(clip.id, { status: "running", predictionId: p.id });
}

/** Demo modu: başlangıç karesine yavaş zoom + etiket, konuşmada ses eklenir. */
async function demoClip(c: Character, clip: Clip, label: string): Promise<string> {
  const image = await ensureLocalFile(clip.startImageUrl);
  const audio = clip.audioUrl ? await ensureLocalFile(clip.audioUrl, "mp3") : null;
  const seconds = audio ? Math.max(2, await mediaDuration(audio)) : 5;
  const frames = Math.round(seconds * 30);
  const text = `DEMO · ${label} · ${engineById(clip.engine)?.label ?? clip.engine}`.replace(/[{}\\]/g, "");

  // Etiket, altyazı (ASS) olarak basılır: drawtext her ffmpeg derlemesinde yok, libass var
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "demo-"));
  const ass = path.join(tmp, "label.ass");
  await fs.writeFile(
    ass,
    `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: L,Poppins ExtraBold,34,&H00FFFFFF,&H00FFFFFF,&H73000000,&H00000000,-1,0,0,0,100,100,0,0,3,14,0,8,60,60,110,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.00,9:00:00.00,L,,0,0,0,,${text}\n`
  );
  const esc = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
  const fontsDir = path.join(process.cwd(), "assets/fonts");

  const { file, url } = await newMediaFile("mp4");
  const vf = [
    "scale=1080:1920:force_original_aspect_ratio=increase",
    "crop=1080:1920",
    `zoompan=z='min(zoom+0.0008,1.12)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`,
    `subtitles='${esc(ass)}':fontsdir='${esc(fontsDir)}'`,
    "format=yuv420p",
  ].join(",");
  const args = ["-loop", "1", "-i", image];
  if (audio) args.push("-i", audio);
  args.push("-vf", vf, "-t", String(seconds), "-c:v", "libx264", "-preset", "veryfast", "-r", "30");
  if (audio) args.push("-c:a", "aac", "-b:a", "128k", "-shortest");
  args.push(file);
  try {
    await ffmpeg(args);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
  void c;
  return url;
}

export async function rateClip(id: string, rating: -1 | 0 | 1) {
  return update(id, { rating });
}
