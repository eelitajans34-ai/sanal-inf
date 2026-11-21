import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Character, Reel, ReelShot } from "@/db/schema";
import { askJson, textAiEnabled } from "@/lib/ai/text";
import { ensureLocalFile, newMediaFile } from "@/lib/media";
import { PRESETS, presetById } from "./presets";
import { createClip } from "./clips";
import { listTemplates, templateFrame } from "./templates";
import { ffmpeg, hasAudioStream, mediaDuration } from "./ffmpeg";

const { reels, clips } = schema;

export type ReelPlan = {
  title: string;
  hook: string;
  caption: string;
  hashtags: string;
  shots: ReelShot[];
};

// ---------- 1) Senaryo ----------

export async function planReel(c: Character, topic: string): Promise<ReelPlan> {
  const templates = await listTemplates(c.id);
  const keys = new Set(templates.map((t) => t.key));
  if (!textAiEnabled()) return sanitizePlan(demoPlan(c, topic), keys);

  const presetList = PRESETS.map((p) => `- ${p.id} (${p.kind}): ${p.label}`).join("\n");
  const templateList = templates
    .map(
      (t) =>
        `- ${t.key} [${t.source === "photo" ? "HAZIR FOTO" : "fikir"}, ${t.shot}${t.talkable ? ", konuşmaya uygun" : ""}]: ${t.title} — ifade: ${t.expression}; uygun hareketler: ${t.presets.join(", ")}`
    )
    .join("\n");
  const plan = await askJson<ReelPlan>(
    c,
    `${c.name} için 15-25 saniyelik bir Instagram Reels senaryosu yaz. Konu: "${topic || "günlük hayatından samimi bir an"}".

Kurallar:
- 3-5 sahne. İLK sahne mutlaka "talk" türünde ve izleyiciyi ilk 2 saniyede yakalayan bir girişle başlasın.
- "talk" sahnelerinde "line": ${c.name}'nın kameraya söyleyeceği Türkçe replik; doğal konuşma dili, en fazla 2 kısa cümle (3-8 saniye). Yazım kurallarına uy.
- "action" sahnelerinde "line" boş olsun; konuşmasız mimik/jest/hareket.
- Son sahne takip etme / yorum yapma çağrısıyla bitsin (talk) veya öpücük/el sallama gibi bir kapanış (action).
- "scene": sahnenin görsel tarifi, İNGİLİZCE: mekan, kıyafet, elinde ne var, ışık. Karakterin fiziksel tarifini YAZMA.
- "presetId": aşağıdaki listeden, sahne türüyle uyumlu olanı seç:
${presetList}
- "templateKey": her sahne için aşağıdaki sahne şablonlarından birini seç. ÖNCE "HAZIR FOTO" olanları tercih et (karakterin gerçek fotoğrafı, en tutarlı sonuç). "talk" sahnelerinde "konuşmaya uygun" şablon seç. Seçtiğin hareket, şablonun "uygun hareketler" listesinde olsun. Aynı Reels'te mekân bütünlüğü için mümkünse aynı/benzer mekândaki şablonları kullan. Şablon seçersen "scene" alanına şablonun sahnesini kısaca yaz.
${templateList}

JSON döndür:
{"title": "kısa başlık", "hook": "ilk saniyelerde ekranda görünecek kısa yazı (max 6 kelime)", "caption": "gönderi metni (karakterin üslubuyla)", "hashtags": "#... (6-10 adet)", "shots": [{"kind": "talk|action", "presetId": "...", "templateKey": "...", "scene": "...", "line": "..."}]}`,
    2500
  );
  return sanitizePlan(plan, keys);
}

export function sanitizePlan(plan: ReelPlan, templateKeys?: Set<string>): ReelPlan {
  const shots = (plan.shots || [])
    .map((s) => {
      const preset = presetById(s.presetId) ?? PRESETS.find((p) => p.kind === s.kind) ?? PRESETS[0];
      return {
        kind: preset.kind,
        presetId: preset.id,
        scene: String(s.scene || "").slice(0, 600),
        line: preset.kind === "talk" ? String(s.line || "").slice(0, 300) : "",
        templateKey:
          s.templateKey && (!templateKeys || templateKeys.has(String(s.templateKey))) ? String(s.templateKey) : undefined,
      };
    })
    .filter((s) => s.kind === "action" || s.line)
    .slice(0, 6);
  return {
    title: String(plan.title || "Yeni Reels").slice(0, 120),
    hook: String(plan.hook || "").slice(0, 80),
    caption: String(plan.caption || ""),
    hashtags: String(plan.hashtags || ""),
    shots,
  };
}

function demoPlan(c: Character, topic: string): ReelPlan {
  const t = topic || "İstanbul'da bir kahve molası";
  return {
    title: t,
    hook: "Bunu denemeden geçme! ☕",
    caption: `Bugün sizi de yanımda götürdüm: ${t} 💜\n\nSiz de gelir miydiniz? Yorumlarda söyleyin ✨\n\nÖpüyorum! 💋`,
    hashtags: `#${c.name.toLowerCase()} #istanbul #reels #kahve #lifestyle #günlükvlog`,
    shots: [
      {
        kind: "talk",
        presetId: "talk-excited",
        templateKey: "kafe-kahvalti",
        scene: "sitting at an outdoor café table with a latte and a croissant",
        line: `Günaydın arkadaşlar! Bugün size ${c.city}'un en tatlı kafesini gösteriyorum.`,
      },
      { kind: "action", presetId: "sip-coffee", templateKey: "kafe-kahvalti", scene: "café table, latte", line: "" },
      {
        kind: "talk",
        presetId: "talk-vlog",
        templateKey: "balkon-gun-batimi",
        scene: "balcony at sunset with a Bosphorus view, coffee",
        line: "Akşamı da Boğaz manzarasıyla kapattım. Sizce hangisi daha güzel?",
      },
      { kind: "action", presetId: "kiss", templateKey: "yatak-odasi-dogal", scene: "warm bedroom close-up", line: "" },
    ],
  };
}

// ---------- 2) Klipleri üret ----------

export async function createReel(
  characterId: string,
  topic: string,
  plan: ReelPlan,
  extra: Partial<Pick<Reel, "routineId" | "publishMode" | "publishAt">> = {}
) {
  const keys = new Set((await listTemplates(characterId)).map((t) => t.key));
  const p = sanitizePlan(plan, keys);
  if (p.shots.length === 0) throw new Error("Senaryoda sahne yok");
  const [reel] = await db
    .insert(reels)
    .values({
      characterId,
      topic,
      title: p.title,
      hook: p.hook,
      caption: p.caption,
      hashtags: p.hashtags,
      shots: p.shots,
      status: "generating",
      ...extra,
    })
    .returning();
  const templates = new Map((await listTemplates(characterId)).map((t) => [t.key, t]));
  for (const [i, s] of p.shots.entries()) {
    const t = s.templateKey ? templates.get(s.templateKey) ?? null : null;
    await createClip({
      characterId,
      kind: s.kind,
      presetId: s.presetId,
      scene: t?.scene || s.scene,
      line: s.line,
      startImageUrl: templateFrame(t) || undefined,
      reelId: reel.id,
      shotIndex: i,
    });
  }
  return reel;
}

export async function reelClips(reelId: string) {
  return db.query.clips.findMany({ where: eq(clips.reelId, reelId), orderBy: asc(clips.shotIndex) });
}

// ---------- 3) Birleştir + altyazı ----------

const W = 1080;
const H = 1920;

/** ASS zaman biçimi: H:MM:SS.cc */
function assTime(t: number) {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = (t % 60).toFixed(2).padStart(5, "0");
  return `${h}:${String(m).padStart(2, "0")}:${s}`;
}

// Altyazı fontunda emoji yok; kutu olarak görünmesinler diye temizlenir
const assEscape = (s: string) =>
  s
    .replace(/[{}]/g, "")
    .replace(/\n/g, " ")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();

/** Repliği 2-4 kelimelik parçalara bölüp sesin süresine orantılı zamanlar. */
export function captionChunks(line: string, start: number, duration: number) {
  const words = line.trim().split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let cur: string[] = [];
  for (const w of words) {
    cur.push(w);
    const len = cur.join(" ").length;
    if (cur.length >= 4 || len > 18 || /[.!?,…]$/.test(w)) {
      chunks.push(cur.join(" "));
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur.join(" "));
  const total = chunks.reduce((a, c) => a + c.length, 0) || 1;
  let t = start;
  return chunks.map((text) => {
    const d = (text.length / total) * duration;
    const item = { text, start: t, end: t + d };
    t += d;
    return item;
  });
}

export function buildAss(
  hook: string,
  segments: { line: string; start: number; duration: number }[],
  totalDuration: number
) {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Poppins ExtraBold,78,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,6,2,2,80,80,560,1
Style: Hook,Poppins ExtraBold,70,&H00FFFFFF,&H00FFFFFF,&H00ED3A7C,&H00000000,-1,0,0,0,100,100,0,0,3,18,0,8,90,90,240,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const lines: string[] = [];
  if (hook) {
    lines.push(`Dialogue: 1,${assTime(0)},${assTime(Math.min(3, totalDuration))},Hook,,0,0,0,,{\\fad(150,250)}${assEscape(hook)}`);
  }
  for (const seg of segments) {
    for (const ch of captionChunks(seg.line, seg.start, seg.duration)) {
      lines.push(
        `Dialogue: 0,${assTime(ch.start)},${assTime(ch.end)},Caption,,0,0,0,,{\\fad(60,60)\\fscx92\\fscy92\\t(0,90,\\fscx100\\fscy100)}${assEscape(ch.text).toLocaleUpperCase("tr")}`
      );
    }
  }
  return header + lines.join("\n") + "\n";
}

export async function renderReel(reelId: string): Promise<Reel> {
  const reel = await db.query.reels.findFirst({ where: eq(reels.id, reelId) });
  if (!reel) throw new Error("Reels bulunamadı");
  const list = await reelClips(reelId);
  if (list.length === 0 || list.some((c) => c.status !== "succeeded")) {
    throw new Error("Tüm klipler hazır olmadan birleştirilemez");
  }
  // Aynı anda iki birleştirme olmasın: yalnızca "generating" veya "failed" durumundan başlatılır
  const [locked] = await db
    .update(reels)
    .set({ status: "rendering", error: "" })
    .where(and(eq(reels.id, reelId), inArray(reels.status, ["generating", "failed"])))
    .returning();
  if (!locked) return reel;

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "reel-"));
  try {
    // a) Her klibi aynı formata getir: 1080x1920, 30 fps, stereo 48 kHz ses
    const parts: string[] = [];
    const segments: { line: string; start: number; duration: number }[] = [];
    let t = 0;
    for (const [i, clip] of list.entries()) {
      const src = await ensureLocalFile(clip.videoUrl, "mp4");
      const out = path.join(tmp, `p${i}.mp4`);
      const withAudio = await hasAudioStream(src);
      const vf = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=30,setsar=1,format=yuv420p`;
      const args = ["-i", src];
      if (!withAudio) args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
      args.push(
        "-map", "0:v:0", "-map", withAudio ? "0:a:0" : "1:a:0",
        "-vf", vf, "-af", "aresample=48000,aformat=channel_layouts=stereo",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-c:a", "aac", "-b:a", "160k", "-shortest", out
      );
      await ffmpeg(args);
      const d = await mediaDuration(out);
      if (clip.kind === "talk" && clip.line) segments.push({ line: clip.line, start: t + 0.1, duration: Math.max(0.5, d - 0.2) });
      t += d;
      parts.push(out);
    }

    // b) Birleştir
    const listFile = path.join(tmp, "list.txt");
    await fs.writeFile(listFile, parts.map((p) => `file '${p}'`).join("\n"));
    const joined = path.join(tmp, "joined.mp4");
    await ffmpeg(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", joined]);

    // c) Altyazı + hook yazısını göm
    const ass = path.join(tmp, "subs.ass");
    await fs.writeFile(ass, buildAss(reel.hook, segments, t));
    const fontsDir = path.join(process.cwd(), "assets/fonts");
    const esc = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
    const { file: outFile, url: videoUrl } = await newMediaFile("mp4");
    await ffmpeg([
      "-i", joined,
      "-vf", `subtitles='${esc(ass)}':fontsdir='${esc(fontsDir)}'`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "copy", "-movflags", "+faststart", outFile,
    ]);

    // d) Kapak görseli
    const { file: coverFile, url: coverUrl } = await newMediaFile("jpg");
    await ffmpeg(["-ss", "0.8", "-i", outFile, "-frames:v", "1", "-q:v", "3", coverFile]);

    const [updated] = await db
      .update(reels)
      .set({ status: "ready", videoUrl, coverUrl, error: "" })
      .where(eq(reels.id, reelId))
      .returning();
    return updated;
  } catch (e) {
    const [updated] = await db
      .update(reels)
      .set({ status: "failed", error: e instanceof Error ? e.message : String(e) })
      .where(eq(reels.id, reelId))
      .returning();
    return updated;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
