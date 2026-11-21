"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { characters, posts } = schema;
import { AUTH_COOKIE, authToken, isValidToken } from "@/lib/auth";
import { publishPost } from "@/lib/publish/run";

async function requireAuth() {
  const jar = await cookies();
  if (!(await isValidToken(jar.get(AUTH_COOKIE)?.value))) throw new Error("Yetkisiz");
}

// ---------- Giriş ----------

export async function login(formData: FormData) {
  const pw = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/panel");
  if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
    redirect(`/giris?hata=1&next=${encodeURIComponent(next)}`);
  }
  const jar = await cookies();
  jar.set(AUTH_COOKIE, await authToken(pw), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect(next.startsWith("/") ? next : "/panel");
}

export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/");
}

// ---------- Karakter ----------

const slugify = (s: string) =>
  s
    .toLocaleLowerCase("tr")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const characterSchema = z.object({
  name: z.string().trim().min(1, "İsim gerekli"),
  handle: z.string().trim().min(1, "Kullanıcı adı gerekli"),
  city: z.string().trim().default("İstanbul"),
  niche: z.string().trim().min(1, "Alan gerekli"),
  bio: z.string().trim().min(1, "Bio gerekli"),
  personality: z.string().trim().min(1, "Kişilik gerekli"),
  voiceRules: z.string().trim().default(""),
  appearance: z.string().trim().min(1, "Görünüş tarifi gerekli"),
  avatarUrl: z.string().trim().default(""),
  instagramUserId: z.string().trim().default(""),
});

function readCharacter(formData: FormData) {
  return characterSchema.parse(Object.fromEntries(formData));
}

export async function createCharacter(formData: FormData) {
  await requireAuth();
  const data = readCharacter(formData);
  let slug = slugify(data.name) || "karakter";
  if (await db.query.characters.findFirst({ where: eq(characters.slug, slug) }))
    slug = `${slug}-${Date.now().toString(36)}`;
  const [c] = await db.insert(characters).values({ ...data, slug }).returning();
  redirect(`/panel/karakter/${c.id}`);
}

export async function updateCharacter(id: string, formData: FormData) {
  await requireAuth();
  const [c] = await db.update(characters).set(readCharacter(formData)).where(eq(characters.id, id)).returning();
  revalidatePath(`/panel/karakter/${id}`);
  revalidatePath(`/k/${c.slug}`);
}

export async function deleteCharacter(id: string) {
  await requireAuth();
  await db.delete(posts).where(eq(posts.characterId, id));
  await db.delete(characters).where(eq(characters.id, id));
  redirect("/panel");
}

// ---------- Gönderi ----------

const postSchema = z.object({
  characterId: z.string().min(1),
  idea: z.string().default(""),
  caption: z.string().trim().min(1, "Metin boş olamaz"),
  hashtags: z.string().default(""),
  imagePrompt: z.string().default(""),
  imageUrl: z.string().default(""),
  scheduledAt: z.string().optional(), // datetime-local, İstanbul saati
  mode: z.enum(["draft", "schedule", "publish"]),
});

/** datetime-local değerini (ör. 2026-11-22T14:30) Türkiye saati (UTC+3) olarak yorumlar. */
function parseIstanbulTime(v?: string) {
  if (!v) return null;
  const d = new Date(`${v}:00+03:00`);
  return isNaN(d.getTime()) ? null : d;
}

export async function savePost(input: z.input<typeof postSchema>) {
  await requireAuth();
  const { mode, scheduledAt, ...data } = postSchema.parse(input);
  const when = parseIstanbulTime(scheduledAt);
  if (mode === "schedule" && !when) throw new Error("Paylaşım zamanı seçmelisin");

  const [post] = await db
    .insert(posts)
    .values({
      ...data,
      status: mode === "schedule" ? "SCHEDULED" : "DRAFT",
      scheduledAt: mode === "schedule" ? when : null,
    })
    .returning();
  if (mode === "publish") await publishPost(post.id);

  revalidatePath("/panel", "layout");
  return { id: post.id };
}

export async function schedulePost(id: string, formData: FormData) {
  await requireAuth();
  const when = parseIstanbulTime(String(formData.get("scheduledAt") || ""));
  if (!when) return;
  await db.update(posts).set({ status: "SCHEDULED", scheduledAt: when, error: "" }).where(eq(posts.id, id));
  revalidatePath("/panel", "layout");
}

export async function publishNow(id: string) {
  await requireAuth();
  await publishPost(id);
  revalidatePath("/panel", "layout");
  revalidatePath("/k/[slug]", "page");
}

export async function deletePost(id: string) {
  await requireAuth();
  await db.delete(posts).where(eq(posts.id, id));
  revalidatePath("/panel", "layout");
}
