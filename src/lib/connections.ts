import Anthropic from "@anthropic-ai/sdk";
import { setting, type SettingKey } from "@/lib/config";
import { rget } from "@/lib/ai/replicate";

const GRAPH = "https://graph.facebook.com/v21.0";

export type TestResult = { ok: boolean; message: string; data?: Record<string, unknown> };

/** Her servis için gerçek bir istekle bağlantıyı doğrular. */
export async function testConnection(key: SettingKey): Promise<TestResult> {
  const value = setting(key);
  if (!value) return { ok: false, message: "Değer girilmemiş" };
  try {
    switch (key) {
      case "ANTHROPIC_API_KEY": {
        const client = new Anthropic({ apiKey: value });
        const r = await client.messages.create({
          model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
          max_tokens: 2000,
          messages: [{ role: "user", content: "Sadece 'tamam' yaz." }],
        });
        return { ok: true, message: `Claude bağlı (${r.model})` };
      }
      case "REPLICATE_API_TOKEN": {
        const acc = await rget<{ username: string; type: string }>("/account");
        return { ok: true, message: `Replicate bağlı: ${acc.username}`, data: { username: acc.username } };
      }
      case "INSTAGRAM_ACCESS_TOKEN": {
        const me = await fetch(`${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(value)}`).then((r) => r.json());
        if (me.error) return { ok: false, message: me.error.message };
        const accounts = await findInstagramAccounts(value);
        return {
          ok: true,
          message: accounts.length
            ? `Bağlı: ${me.name}. Instagram hesapları: ${accounts.map((a) => `@${a.username} (${a.id})`).join(", ")}`
            : `Bağlı: ${me.name}, ama sayfaya bağlı Instagram Business hesabı bulunamadı`,
          data: { accounts },
        };
      }
      case "PUBLIC_BASE_URL": {
        if (!/^https:\/\//.test(value)) return { ok: false, message: "https:// ile başlayan herkese açık bir adres olmalı" };
        const r = await fetch(`${value.replace(/\/$/, "")}/luna.jpg`, { method: "HEAD" });
        return r.ok
          ? { ok: true, message: "Adres dışarıdan erişilebilir" }
          : { ok: false, message: `Adrese ulaşıldı ama dosya gelmedi (HTTP ${r.status})` };
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/401|unauthor|invalid/i.test(msg)) return { ok: false, message: "Anahtar geçersiz veya yetkisiz" };
    if (/fetch failed|ENOTFOUND|ECONN|403/i.test(msg)) return { ok: false, message: `Servise ulaşılamadı: ${msg.slice(0, 160)}` };
    return { ok: false, message: msg.slice(0, 300) };
  }
  return { ok: false, message: "Bilinmeyen ayar" };
}

/** Facebook sayfalarına bağlı Instagram Business/Creator hesaplarını bulur. */
export async function findInstagramAccounts(token: string) {
  const res = await fetch(
    `${GRAPH}/me/accounts?fields=name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`
  ).then((r) => r.json());
  const list: { id: string; username: string; page: string }[] = [];
  for (const p of res.data ?? []) {
    if (p.instagram_business_account) {
      list.push({ id: p.instagram_business_account.id, username: p.instagram_business_account.username, page: p.name });
    }
  }
  return list;
}
