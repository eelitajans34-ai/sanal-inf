// Replicate HTTP API için küçük yardımcılar (SDK'sız, fetch ile).
// REPLICATE_API_BASE yalnızca test için değiştirilir.
const BASE = () => (process.env.REPLICATE_API_BASE || "https://api.replicate.com/v1").replace(/\/$/, "");

export const replicateEnabled = () => Boolean(process.env.REPLICATE_API_TOKEN);

function headers(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, ...extra };
}

export async function rget<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path.startsWith("http") ? path : `${BASE()}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`Replicate ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function rexists(path: string): Promise<boolean> {
  const res = await fetch(`${BASE()}${path}`, { headers: headers() });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Replicate ${res.status}: ${await res.text()}`);
  return true;
}

export async function rpost<T = unknown>(path: string, body: unknown, extra: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", ...extra }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Replicate ${res.status}: ${await res.text()}`);
  return res.json();
}

type Prediction = {
  id: string;
  status: string;
  output: unknown;
  error?: string;
  urls: { get: string };
};

/** Tahmin oluşturur ve bitene kadar bekler; çıktı görsel URL'sini döner. */
export async function runPrediction(
  path: "/predictions" | `/models/${string}/predictions`,
  body: Record<string, unknown>
): Promise<string> {
  let p = await rpost<Prediction>(path, body, { Prefer: "wait=60" });
  const deadline = Date.now() + 180_000;
  while (!["succeeded", "failed", "canceled"].includes(p.status)) {
    if (Date.now() > deadline) throw new Error("Görsel üretimi zaman aşımına uğradı");
    await new Promise((r) => setTimeout(r, 2000));
    p = await rget<Prediction>(p.urls.get);
  }
  if (p.status !== "succeeded") throw new Error(p.error || "Görsel üretilemedi");
  const out = Array.isArray(p.output) ? p.output[0] : p.output;
  if (typeof out !== "string") throw new Error("Beklenmeyen çıktı");
  return out;
}

/** Dosyayı Replicate'e yükler, eğitim girdisi olarak kullanılabilecek URL döner. */
export async function uploadFile(bytes: Uint8Array, filename: string, type: string): Promise<string> {
  const form = new FormData();
  form.append("content", new Blob([bytes as BlobPart], { type }), filename);
  const res = await fetch(`${BASE()}/files`, { method: "POST", headers: headers(), body: form });
  if (!res.ok) throw new Error(`Dosya yüklenemedi: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.urls.get as string;
}
