import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Routine } from "@/db/schema";
import { generateCaption, generateIdeas } from "@/lib/ai/text";
import { generateImage, imageAiEnabled } from "@/lib/ai/image";
import { persistRemoteImage } from "@/lib/media";
import { planReel, createReel } from "@/lib/video/reels";
import { planMontage, createMontageReel } from "@/lib/video/montage";
import { listTemplates } from "@/lib/video/templates";

const { routines, routineRuns, posts } = schema;
const TZ = "Europe/Istanbul";

export const ROUTINE_TYPE_LABEL: Record<Routine["type"], string> = {
  reels: "Konuşan AI Reels",
  montage: "Fotoğraf montajı (Reels)",
  photo: "Fotoğraflı gönderi",
};
export const DAY_LABEL = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

/** İstanbul saatine göre şu an: tarih, haftanın günü (0=Pazar), SS:DD */
export function istanbulNow(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = g("hour") === "24" ? "00" : g("hour");
  return {
    date: `${g("year")}-${g("month")}-${g("day")}`,
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(g("weekday")),
    time: `${hour}:${g("minute")}`,
  };
}

/** Paylaşım zamanı: bugün publishTime; geçtiyse yarın. */
function publishDate(publishTime: string) {
  const now = istanbulNow();
  const today = new Date(`${now.date}T${publishTime}:00+03:00`);
  return today.getTime() > Date.now() + 5 * 60_000 ? today : new Date(today.getTime() + 24 * 3600_000);
}

function nextTopic(r: Routine) {
  const list = r.topics
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
  if (list.length === 0) return { topic: "", index: r.topicIndex };
  const i = r.topicIndex % list.length;
  return { topic: list[i], index: r.topicIndex + 1 };
}

/** Zamanı gelmiş rutinleri çalıştırır. */
export async function runDueRoutines() {
  const now = istanbulNow();
  const all = await db.query.routines.findMany({ where: eq(routines.enabled, true) });
  const due = all.filter((r) => r.days.includes(now.weekday) && r.time <= now.time && r.lastRunDate !== now.date);
  const results = [];
  for (const r of due) results.push(await runRoutine(r.id));
  return results;
}

/** Bir rutini hemen çalıştırır (zamanı beklemeden de kullanılabilir). */
export async function runRoutine(routineId: string) {
  const r = await db.query.routines.findFirst({ where: eq(routines.id, routineId) });
  if (!r) throw new Error("Rutin bulunamadı");
  const c = await db.query.characters.findFirst({ where: eq(schema.characters.id, r.characterId) });
  if (!c) throw new Error("Karakter bulunamadı");

  const now = istanbulNow();
  const { topic, index } = nextTopic(r);
  // Aynı gün ikinci kez çalışmasın diye önce işaretle
  await db
    .update(routines)
    .set({ lastRunDate: now.date, topicIndex: index, lastStatus: "started", lastMessage: topic })
    .where(eq(routines.id, r.id));
  const [run] = await db
    .insert(routineRuns)
    .values({ routineId: r.id, date: now.date, topic, status: "started" })
    .returning();

  const publishAt = r.publishMode === "schedule" ? publishDate(r.publishTime) : null;
  try {
    let message = "";
    if (r.type === "photo") {
      const [idea] = await generateIdeas(c, 1, topic);
      const cap = await generateCaption(c, idea || topic || "günlük hayatımdan bir an");
      let imageUrl = "";
      if (imageAiEnabled()) {
        imageUrl = await persistRemoteImage(await generateImage(c, cap.imagePrompt || idea));
      } else {
        // Replicate yoksa hazır fotoğraflardan biri kullanılır
        const photos = (await listTemplates(c.id)).filter((t) => t.source === "photo");
        imageUrl = photos.length ? photos[(index + photos.length) % photos.length].imageUrl : c.avatarUrl;
      }
      const [post] = await db
        .insert(posts)
        .values({
          characterId: c.id,
          idea: idea || topic,
          caption: cap.caption,
          hashtags: cap.hashtags,
          imagePrompt: cap.imagePrompt,
          imageUrl,
          status: publishAt ? "SCHEDULED" : "DRAFT",
          scheduledAt: publishAt,
        })
        .returning();
      await db.update(routineRuns).set({ status: "done", postId: post.id, message: idea }).where(eq(routineRuns.id, run.id));
      message = `Gönderi hazır: ${idea}`;
    } else if (r.type === "montage") {
      const plan = await planMontage(c, topic);
      const reel = await createMontageReel(c.id, topic, plan, {
        routineId: r.id,
        publishMode: publishAt ? "schedule" : "draft",
        publishAt,
      });
      if (reel.status === "failed") throw new Error(reel.error);
      await db.update(routineRuns).set({ status: "done", reelId: reel.id, message: plan.title }).where(eq(routineRuns.id, run.id));
      message = `Montaj hazır: ${plan.title}`;
    } else {
      const plan = await planReel(c, topic);
      const reel = await createReel(c.id, topic, plan, {
        routineId: r.id,
        publishMode: publishAt ? "schedule" : "draft",
        publishAt,
      });
      // Klipler arka planda üretilir; bitince işçi birleştirir ve gönderiyi oluşturur
      await db
        .update(routineRuns)
        .set({ status: "started", reelId: reel.id, message: `${plan.title} — klipler üretiliyor` })
        .where(eq(routineRuns.id, run.id));
      message = `Reels başlatıldı: ${plan.title}`;
    }
    await db.update(routines).set({ lastStatus: "done", lastMessage: message }).where(eq(routines.id, r.id));
    return { routine: r.name, ok: true, message };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.update(routineRuns).set({ status: "failed", message }).where(eq(routineRuns.id, run.id));
    await db.update(routines).set({ lastStatus: "failed", lastMessage: message }).where(eq(routines.id, r.id));
    return { routine: r.name, ok: false, message };
  }
}
