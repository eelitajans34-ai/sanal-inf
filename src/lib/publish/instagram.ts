import type { Character, Post } from "@/db/schema";
import { setting } from "@/lib/config";

// Instagram Graph API (Business/Creator hesap gerekir).
// Gerekli: INSTAGRAM_ACCESS_TOKEN ve karakterin instagramUserId alanı.
// Not: Instagram görseli herkese açık bir URL'den çeker; data: URL'leri çalışmaz.
const GRAPH = "https://graph.facebook.com/v21.0";

export type PublishResult = { ok: true; externalId: string; demo?: boolean } | { ok: false; error: string };

export async function publishToInstagram(
  post: Post,
  character: Character
): Promise<PublishResult> {
  const token = setting("INSTAGRAM_ACCESS_TOKEN");
  if (!token || !character.instagramUserId) {
    // Demo modu: gerçekten paylaşmadan "paylaşıldı" sayar.
    return { ok: true, externalId: `demo-${post.id}`, demo: true };
  }

  const isReel = Boolean(post.videoUrl);
  const mediaUrl = absoluteUrl(isReel ? post.videoUrl : post.imageUrl);
  if (!mediaUrl || mediaUrl.startsWith("data:")) {
    return { ok: false, error: "Instagram için herkese açık bir görsel/video URL'si gerekli (PUBLIC_BASE_URL)" };
  }

  const caption = [post.caption, post.hashtags].filter(Boolean).join("\n\n");
  try {
    const body = isReel
      ? { media_type: "REELS", video_url: mediaUrl, caption, share_to_feed: true, access_token: token }
      : { image_url: mediaUrl, caption, access_token: token };
    const create = await fetch(`${GRAPH}/${character.instagramUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
    if (!create.id) return { ok: false, error: create.error?.message || "Medya oluşturulamadı" };

    // Videolar Instagram tarafında işlenir; hazır olana kadar bekle
    if (isReel) {
      const deadline = Date.now() + 240_000;
      for (;;) {
        const st = await fetch(`${GRAPH}/${create.id}?fields=status_code&access_token=${token}`).then((r) => r.json());
        if (st.status_code === "FINISHED") break;
        if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
          return { ok: false, error: `Instagram video işleme hatası (${st.status_code})` };
        }
        if (Date.now() > deadline) return { ok: false, error: "Instagram video işleme zaman aşımı" };
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

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
  const base = setting("PUBLIC_BASE_URL").replace(/\/$/, "");
  return base ? `${base}${url}` : "";
}
