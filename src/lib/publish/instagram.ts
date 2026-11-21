import type { Character, Post } from "@/db/schema";

// Instagram Graph API (Business/Creator hesap gerekir).
// Gerekli: INSTAGRAM_ACCESS_TOKEN ve karakterin instagramUserId alanı.
// Not: Instagram görseli herkese açık bir URL'den çeker; data: URL'leri çalışmaz.
const GRAPH = "https://graph.facebook.com/v21.0";

export type PublishResult = { ok: true; externalId: string; demo?: boolean } | { ok: false; error: string };

export async function publishToInstagram(
  post: Post,
  character: Character
): Promise<PublishResult> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token || !character.instagramUserId) {
    // Demo modu: gerçekten paylaşmadan "paylaşıldı" sayar.
    return { ok: true, externalId: `demo-${post.id}`, demo: true };
  }

  const imageUrl = absoluteUrl(post.imageUrl);
  if (!imageUrl || imageUrl.startsWith("data:")) {
    return { ok: false, error: "Instagram için herkese açık bir görsel URL'si gerekli" };
  }

  const caption = [post.caption, post.hashtags].filter(Boolean).join("\n\n");
  try {
    const create = await fetch(`${GRAPH}/${character.instagramUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
    }).then((r) => r.json());
    if (!create.id) return { ok: false, error: create.error?.message || "Medya oluşturulamadı" };

    const pub = await fetch(`${GRAPH}/${character.instagramUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: create.id, access_token: token }),
    }).then((r) => r.json());
    if (!pub.id) return { ok: false, error: pub.error?.message || "Paylaşılamadı" };

    return { ok: true, externalId: pub.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function absoluteUrl(url: string) {
  if (!url || /^(https?:|data:)/.test(url)) return url;
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  return base ? `${base}${url}` : "";
}
