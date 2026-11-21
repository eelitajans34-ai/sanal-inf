import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Character, MontageSlide, Reel } from "@/db/schema";
import { askJson, textAiEnabled } from "@/lib/ai/text";
import { ensureLocalFile, newMediaFile } from "@/lib/media";
import { ffmpeg } from "./ffmpeg";
import { listTemplates } from "./templates";

// Fotoğraf montajı: Replicate gerektirmeyen hareketli video.
// Her fotoğrafa yavaş zoom/kaydırma, aralarına geçiş, üstüne yazılar.

const W = 1080;
const H = 1920;
const FPS = 30;
export const MONTAGE_MOTIONS = ["in", "panup", "out", "panleft", "in", "panright"] as const;
const TRANSITIONS = ["fade", "smoothleft", "slideup", "circleopen", "smoothright", "fadeblack", "slidedown", "wiperight"];

export type MontagePlan = {
  title: string;
  hook: string; // üstte sabit duran başlık
  caption: string;
  hashtags: string;
  slides: MontageSlide[];
};

// ---------- Plan ----------

export async function planMontage(c: Character, topic: string): Promise<MontagePlan> {
  const photos = (await listTemplates(c.id)).filter((t) => t.source === "photo");
  if (photos.length === 0) throw new Error("Montaj için önce karakterin fotoğraf şablonları olmalı");

  if (!textAiEnabled()) {
    const pick = photos.slice(0, 8);
    return {
      title: topic || `${c.name} ile bir gün`,
      hook: (topic || `${c.name} ile bir gün`).slice(0, 30),
      caption: `${topic || "Bugün"} 💜\n\nSizce en güzeli hangisi? Yorumlara yazın!\n\nÖpüyorum! 💋`,
      hashtags: `#${c.name.toLowerCase()} #istanbul #reels #lifestyle`,
      slides: pick.map((t, i) => ({ imageUrl: t.frameUrl, text: i === 0 ? "Günaydın!" : t.title, motion: MONTAGE_MOTIONS[i % MONTAGE_MOTIONS.length] })),
    };
  }

  const list = photos.map((t) => `- ${t.key}: ${t.title} (${t.shot}, ${t.expression})`).join("\n");
  const plan = await askJson<{ title: string; hook: string; caption: string; hashtags: string; slides: { key: string; text: string }[] }>(
    c,
    `${c.name} için fotoğraflardan oluşan 15-25 saniyelik hareketli bir Instagram Reels montajı planla. Konu: "${topic || "günlük hayatından bir gün"}".

Kurallar:
- Aşağıdaki fotoğraflardan konuya en uygun 6-9 tanesini, hikâye akışı olacak sırayla seç (ör. sabahtan akşama).
- Her fotoğraf için ekranda görünecek kısa Türkçe yazı: en fazla 4 kelime, emoji YOK, karakterin samimi üslubunda.
- Son karenin yazısı bir kapanış olsun (ör. "Öpüyorum!").
- "hook": videonun üstünde sabit duran kısa başlık (en fazla 4 kelime, emoji yok).
- "caption": gönderi metni (karakterin üslubu ve yazım kurallarıyla).

Fotoğraflar:
${list}

JSON döndür: {"title": "...", "hook": "...", "caption": "...", "hashtags": "#... (6-10 adet)", "slides": [{"key": "fotoğraf anahtarı", "text": "..."}]}`
  );

  const byKey = new Map(photos.map((t) => [t.key, t]));
  const slides = (plan.slides || [])
    .filter((s) => byKey.has(s.key))
    .slice(0, 10)
    .map((s, i) => ({
      imageUrl: byKey.get(s.key)!.frameUrl,
      text: String(s.text || "").slice(0, 40),
      motion: MONTAGE_MOTIONS[i % MONTAGE_MOTIONS.length],
    }));
  if (slides.length < 2) throw new Error("Montaj planı oluşturulamadı, tekrar dene");
  return {
    title: String(plan.title || topic).slice(0, 120),
    hook: String(plan.hook || "").slice(0, 40),
    caption: String(plan.caption || ""),
    hashtags: String(plan.hashtags || ""),
    slides,
  };
}

export async function createMontageReel(
  characterId: string,
  topic: string,
  plan: MontagePlan,
  extra: Partial<Pick<Reel, "routineId" | "publishMode" | "publishAt">> = {}
) {
  const slides = (plan.slides || []).filter((s) => s.imageUrl).slice(0, 12);
  if (slides.length < 2) throw new Error("En az 2 fotoğraf seç");
  const [reel] = await db
    .insert(schema.reels)
    .values({
      characterId,
      kind: "montage",
      topic,
      title: plan.title || topic || "Montaj",
      hook: plan.hook,
      caption: plan.caption,
      hashtags: plan.hashtags,
      slides,
      status: "rendering",
      ...extra,
    })
    .returning();
  return renderMontage(reel.id);
}

// ---------- Video ----------

function ts(t: number) {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${(t % 60).toFixed(2).padStart(5, "0")}`;
}

const clean = (s: string) =>
  s
    .replace(/[{}\\]/g, "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();

export async function renderMontage(reelId: string): Promise<Reel> {
  const reel = await db.query.reels.findFirst({ where: eq(schema.reels.id, reelId) });
  if (!reel) throw new Error("Montaj bulunamadı");
  const c = await db.query.characters.findFirst({ where: eq(schema.characters.id, reel.characterId) });
  await db.update(schema.reels).set({ status: "rendering", error: "" }).where(eq(schema.reels.id, reelId));

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "montage-"));
  try {
    const slides = reel.slides;
    const D = slides.length > 8 ? 2.3 : 2.6; // sahne süresi
    const T = 0.45; // geçiş
    const N = Math.round(D * FPS);
    const motions: Record<string, [string, string, string]> = {
      in: ["min(1+0.0011*on,1.14)", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"],
      out: ["max(1.14-0.0011*on,1)", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"],
      panup: ["1.12", "iw/2-(iw/zoom/2)", `(ih-ih/zoom)*(1-on/${N})`],
      panleft: ["1.12", `(iw-iw/zoom)*(1-on/${N})`, "ih/2-(ih/zoom/2)"],
      panright: ["1.12", `(iw-iw/zoom)*(on/${N})`, "ih/2-(ih/zoom/2)"],
    };

    const args: string[] = [];
    for (const s of slides) args.push("-loop", "1", "-t", String(D + 0.1), "-i", await ensureLocalFile(s.imageUrl));
    args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");

    const fc: string[] = [];
    slides.forEach((s, i) => {
      const [z, x, y] = motions[s.motion || MONTAGE_MOTIONS[i % MONTAGE_MOTIONS.length]] ?? motions.in;
      // zoompan titremesin diye önce büyük ölçeğe çıkarılır; kare olmayan fotoğraflar 9:16'ya kırpılır
      fc.push(
        `[${i}:v]scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W * 2}:${H * 2},setsar=1,` +
          `zoompan=z='${z}':x='${x}':y='${y}':d=${N}:s=${W}x${H}:fps=${FPS},eq=contrast=1.04:saturation=1.06,` +
          `trim=duration=${D},setpts=PTS-STARTPTS,fps=${FPS},settb=1/${FPS},format=yuv420p[v${i}]`
      );
    });
    let prev = "v0";
    let off = D - T;
    for (let i = 1; i < slides.length; i++) {
      fc.push(`[${prev}][v${i}]xfade=transition=${TRANSITIONS[(i - 1) % TRANSITIONS.length]}:duration=${T}:offset=${off.toFixed(3)}[x${i}]`);
      prev = `x${i}`;
      off += D - T;
    }
    const total = D * slides.length - T * (slides.length - 1);

    // Yazılar
    let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Big,Poppins ExtraBold,92,&H00FFFFFF,&H00FFFFFF,&H00000000,&H78000000,-1,0,0,0,100,100,0,0,1,5,3,2,80,80,430,1
Style: Top,Poppins ExtraBold,52,&H00FFFFFF,&H00FFFFFF,&H00ED3A7C,&H00000000,-1,0,0,0,100,100,2,0,3,16,0,8,80,80,170,1
Style: Handle,Poppins ExtraBold,40,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,1,0,1,3,2,2,80,80,250,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
    if (reel.hook) ass += `Dialogue: 1,${ts(0)},${ts(total)},Top,,0,0,0,,${clean(reel.hook).toLocaleUpperCase("tr")}\n`;
    let t = 0;
    slides.forEach((s, i) => {
      const start = t + (i ? 0.25 : 0.15);
      const end = t + D - T + (i === slides.length - 1 ? T : 0) - 0.05;
      const text = clean(s.text).toLocaleUpperCase("tr");
      if (text) ass += `Dialogue: 0,${ts(start)},${ts(end)},Big,,0,0,0,,{\\fad(180,150)\\fscx85\\fscy85\\t(0,220,\\fscx100\\fscy100)}${text}\n`;
      t += D - T;
    });
    if (c?.handle) ass += `Dialogue: 0,${ts(Math.max(0, total - 1.6))},${ts(total)},Handle,,0,0,0,,{\\fad(200,0)}${clean(c.handle)}\n`;
    const assFile = path.join(tmp, "subs.ass");
    await fs.writeFile(assFile, ass);
    const esc = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
    const fontsDir = path.join(process.cwd(), "assets/fonts");
    fc.push(`[${prev}]subtitles='${esc(assFile)}':fontsdir='${esc(fontsDir)}',fade=t=out:st=${(total - 0.4).toFixed(2)}:d=0.4[out]`);

    const { file, url: videoUrl } = await newMediaFile("mp4");
    await ffmpeg(
      [
        ...args,
        "-filter_complex", fc.join(";"),
        "-map", "[out]", "-map", `${slides.length}:a`,
        "-t", total.toFixed(2), "-r", String(FPS),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", file,
      ],
      600_000
    );
    const { file: coverFile, url: coverUrl } = await newMediaFile("jpg");
    await ffmpeg(["-ss", "0.6", "-i", file, "-frames:v", "1", "-q:v", "3", coverFile]);

    const [updated] = await db
      .update(schema.reels)
      .set({ status: "ready", videoUrl, coverUrl, error: "" })
      .where(eq(schema.reels.id, reelId))
      .returning();
    return updated;
  } catch (e) {
    const [updated] = await db
      .update(schema.reels)
      .set({ status: "failed", error: e instanceof Error ? e.message : String(e) })
      .where(eq(schema.reels.id, reelId))
      .returning();
    return updated;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
