import { db, schema } from "@/lib/db";

// Panelden girilen anahtarlar veritabanında tutulur ve .env değerlerinin önüne geçer.
// Senkron erişim için süreç genelinde bir önbellek kullanılır (globalThis: Next.js'in farklı
// paketleri arasında paylaşılsın diye).

export const SETTING_KEYS = [
  "ANTHROPIC_API_KEY",
  "REPLICATE_API_TOKEN",
  "INSTAGRAM_ACCESS_TOKEN",
  "PUBLIC_BASE_URL",
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

type Cache = { values: Partial<Record<SettingKey, string>>; loadedAt: number };
const g = globalThis as unknown as { __sanalInfSettings?: Cache; __sanalInfSettingsLoading?: Promise<void> };

/** Ayarları veritabanından önbelleğe yükler (en fazla 30 sn'de bir). */
export async function ensureSettings(force = false) {
  const cache = g.__sanalInfSettings;
  if (!force && cache && Date.now() - cache.loadedAt < 30_000) return;
  if (!force && g.__sanalInfSettingsLoading) return g.__sanalInfSettingsLoading;
  g.__sanalInfSettingsLoading = (async () => {
    try {
      const rows = await db.select().from(schema.settings);
      const values: Cache["values"] = {};
      for (const r of rows) if ((SETTING_KEYS as readonly string[]).includes(r.key)) values[r.key as SettingKey] = r.value;
      g.__sanalInfSettings = { values, loadedAt: Date.now() };
    } catch {
      // tablo henüz yoksa (kurulum öncesi) .env ile devam
      g.__sanalInfSettings = { values: {}, loadedAt: Date.now() };
    } finally {
      g.__sanalInfSettingsLoading = undefined;
    }
  })();
  return g.__sanalInfSettingsLoading;
}

/** Ayar değeri: önce panel, sonra .env. */
export function setting(key: SettingKey): string {
  if (!g.__sanalInfSettings) void ensureSettings();
  return (g.__sanalInfSettings?.values[key] || process.env[key] || "").trim();
}

/** Değerin nereden geldiği (panelde göstermek için). */
export function settingSource(key: SettingKey): "panel" | "env" | "" {
  if (g.__sanalInfSettings?.values[key]) return "panel";
  if (process.env[key]) return "env";
  return "";
}

export async function saveSetting(key: SettingKey, value: string) {
  const v = value.trim();
  await db
    .insert(schema.settings)
    .values({ key, value: v })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: v } });
  await ensureSettings(true);
}

/** Anahtarı ekranda göstermek için maskeler. */
export function mask(v: string) {
  if (!v) return "";
  if (v.length <= 12) return "•".repeat(v.length);
  return `${v.slice(0, 7)}…${v.slice(-4)}`;
}
