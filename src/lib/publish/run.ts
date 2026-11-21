import { and, asc, eq, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { posts } = schema;
import { publishToInstagram } from "./instagram";

/** Tek bir gönderiyi paylaşır ve durumunu günceller. */
export async function publishPost(postId: string) {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId), with: { character: true } });
  if (!post) throw new Error("Gönderi bulunamadı");

  const result = await publishToInstagram(post, post.character);
  const [updated] = await db
    .update(posts)
    .set(
      result.ok
        ? { status: "PUBLISHED", publishedAt: new Date(), externalId: result.externalId, error: "" }
        : { status: "FAILED", error: result.error }
    )
    .where(eq(posts.id, post.id))
    .returning();
  return updated;
}

/** Zamanı gelmiş tüm planlı gönderileri paylaşır (cron bunu çağırır). */
export async function publishDuePosts() {
  const due = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.status, "SCHEDULED"), lte(posts.scheduledAt, new Date())))
    .orderBy(asc(posts.scheduledAt))
    .limit(20);
  const results = [];
  for (const p of due) {
    const updated = await publishPost(p.id);
    results.push({ id: p.id, status: updated.status, error: updated.error });
  }
  return results;
}
