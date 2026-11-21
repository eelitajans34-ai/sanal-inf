import { and, eq, inArray, isNull, lt, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ensureSettings } from "@/lib/config";
import { advanceClip } from "@/lib/video/clips";
import { renderReel } from "@/lib/video/reels";
import { publishDuePosts } from "@/lib/publish/run";
import { refreshAllTrainings } from "@/lib/ai/training";
import { runDueRoutines } from "@/lib/routines";

const { clips, reels, posts, routineRuns } = schema;

// Arka plan işçisi: uygulama açıkken her dakika çalışır (src/instrumentation.ts),
// ayrıca /api/cron/tick ile dışarıdan da tetiklenebilir.
const g = globalThis as unknown as { __sanalInfTick?: Promise<TickReport> };

export type TickReport = {
  clips: number;
  rendered: number;
  posts: number;
  published: number;
  trainings: number;
  routines: { routine: string; ok: boolean; message: string }[];
  errors: string[];
};

export async function tick(): Promise<TickReport> {
  // Üst üste binmesin
  if (g.__sanalInfTick) return g.__sanalInfTick;
  g.__sanalInfTick = runTick().finally(() => {
    g.__sanalInfTick = undefined;
  });
  return g.__sanalInfTick;
}

async function step<T>(errors: string[], name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    return fallback;
  }
}

async function runTick(): Promise<TickReport> {
  await ensureSettings();
  const errors: string[] = [];

  // 1) Bekleyen video klipleri ilerlet
  const clipCount = await step(errors, "klipler", async () => {
    // 15 dakikadır "starting"te takılı kalanlar başarısız sayılır
    await db
      .update(clips)
      .set({ status: "failed", error: "Hazırlık yarıda kaldı" })
      .where(and(eq(clips.status, "starting"), lt(clips.updatedAt, new Date(Date.now() - 15 * 60_000))));
    const pending = await db
      .select({ id: clips.id })
      .from(clips)
      .where(inArray(clips.status, ["preparing", "running"]))
      .limit(8);
    for (const c of pending) await advanceClip(c.id);
    return pending.length;
  }, 0);

  // 2) Klipleri hazır olan AI reels'leri birleştir
  const rendered = await step(errors, "birleştirme", async () => {
    const generating = await db.select().from(reels).where(and(eq(reels.status, "generating"), eq(reels.kind, "ai")));
    let n = 0;
    for (const r of generating) {
      const list = await db.select({ status: clips.status, error: clips.error }).from(clips).where(eq(clips.reelId, r.id));
      if (list.length === 0) continue;
      const failed = list.find((x) => x.status === "failed");
      if (failed) {
        await db.update(reels).set({ status: "failed", error: `Bir sahne üretilemedi: ${failed.error}` }).where(eq(reels.id, r.id));
        if (r.routineId) await db.update(routineRuns).set({ status: "failed", message: failed.error }).where(eq(routineRuns.reelId, r.id));
        continue;
      }
      if (list.every((x) => x.status === "succeeded")) {
        await renderReel(r.id);
        n++;
      }
    }
    return n;
  }, 0);

  // 3) Hazır reels'lerden (günlük işler) gönderi oluştur
  const postCount = await step(errors, "gönderi", async () => {
    const ready = await db
      .select()
      .from(reels)
      .where(and(eq(reels.status, "ready"), ne(reels.publishMode, "none"), isNull(reels.postId)));
    for (const r of ready) {
      const schedule = r.publishMode === "schedule" && r.publishAt;
      const [post] = await db
        .insert(posts)
        .values({
          characterId: r.characterId,
          idea: `Reels: ${r.title}`,
          caption: r.caption,
          hashtags: r.hashtags,
          imageUrl: r.coverUrl,
          videoUrl: r.videoUrl,
          status: schedule ? "SCHEDULED" : "DRAFT",
          // Paylaşım saati geçmişse hemen paylaşılır
          scheduledAt: schedule ? r.publishAt : null,
        })
        .returning();
      await db.update(reels).set({ postId: post.id }).where(eq(reels.id, r.id));
      await db
        .update(routineRuns)
        .set({ status: "done", postId: post.id, message: `${r.title} — gönderi ${schedule ? "planlandı" : "onaya düştü"}` })
        .where(eq(routineRuns.reelId, r.id));
    }
    return ready.length;
  }, 0);

  // 4) Zamanı gelen gönderileri paylaş
  const published = await step(errors, "paylaşım", async () => (await publishDuePosts()).length, 0);

  // 5) LoRA eğitimlerini yokla
  const trainings = await step(errors, "eğitim", refreshAllTrainings, 0);

  // 6) Günlük işler
  const routineResults = await step(errors, "günlük işler", runDueRoutines, []);

  return { clips: clipCount, rendered, posts: postCount, published, trainings, routines: routineResults, errors };
}
