const TZ = "Europe/Istanbul";

export function fmtDateTime(d: Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Tarihin İstanbul saatine göre gün anahtarı: 2026-11-22 */
export function dayKey(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

/** datetime-local input için İstanbul saatine göre değer */
export function toLocalInput(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}`;
}

export const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Taslak", cls: "bg-gray-100 text-gray-700" },
  SCHEDULED: { label: "Planlandı", cls: "bg-amber-100 text-amber-800" },
  PUBLISHED: { label: "Paylaşıldı", cls: "bg-emerald-100 text-emerald-800" },
  FAILED: { label: "Hata", cls: "bg-red-100 text-red-700" },
};
