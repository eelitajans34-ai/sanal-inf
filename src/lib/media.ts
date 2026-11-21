import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

// Replicate'in döndürdüğü görsel linkleri bir süre sonra silinir.
// Bu yüzden üretilen görseli indirip kendi depomuzda saklıyoruz.
// Canlıda kalıcı disk yoksa (ör. Vercel) burayı S3/Supabase Storage ile değiştir.
export const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR || ".data/media");

export async function persistRemoteImage(url: string): Promise<string> {
  if (!/^https?:/.test(url)) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type") || "";
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const name = `${crypto.randomUUID()}.${ext}`;
    await fs.mkdir(MEDIA_DIR, { recursive: true });
    await fs.writeFile(path.join(MEDIA_DIR, name), buf);
    return `/api/media/${name}`;
  } catch {
    return url;
  }
}

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

export const mimeFor = (file: string) => MIME[file.split(".").pop()?.toLowerCase() || ""] || "application/octet-stream";

/** Yeni medya dosyası için yol ve uygulama içi adres üretir. */
export async function newMediaFile(ext: string) {
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  const name = `${crypto.randomUUID()}.${ext}`;
  return { file: path.join(MEDIA_DIR, name), url: `/api/media/${name}` };
}

/** Uygulama içi /api/media/... adresini disk yoluna çevirir (yoksa null). */
export function mediaPath(url: string) {
  if (!url.startsWith("/api/media/")) return null;
  return path.join(MEDIA_DIR, path.basename(url));
}

/** Uzak dosyayı (video/ses) indirip saklar. */
export async function persistRemoteFile(url: string, ext: string): Promise<string> {
  if (!/^https?:/.test(url)) return url;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Dosya indirilemedi (${res.status})`);
  const { file, url: local } = await newMediaFile(ext);
  await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
  return local;
}

/** Her türlü medya adresini (data:, http, /api/media, /public) diskte bir dosyaya çevirir. */
export async function ensureLocalFile(url: string, fallbackExt = "jpg"): Promise<string> {
  const local = mediaPath(url);
  if (local) return local;
  if (!url.startsWith("data:") && !/^https?:/.test(url)) {
    return path.join(process.cwd(), "public", path.normalize(url).replace(/^(\.\.[/\\])+/, ""));
  }
  const { bytes, type } = await loadImage(url);
  const ext = Object.entries(MIME).find(([, m]) => m === type)?.[0] || fallbackExt;
  const { file } = await newMediaFile(ext);
  await fs.writeFile(file, bytes);
  return file;
}

/** Uygulamadaki herhangi bir görsel adresinin baytlarını okur. */
export async function loadImage(url: string): Promise<{ bytes: Buffer; type: string }> {
  if (url.startsWith("data:")) {
    const m = url.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/);
    if (!m) throw new Error("Geçersiz data URL");
    return {
      bytes: m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3])),
      type: m[1],
    };
  }
  if (/^https?:/.test(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Görsel indirilemedi: ${url}`);
    return { bytes: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") || "image/jpeg" };
  }
  const ext = url.split(".").pop()?.toLowerCase() || "jpg";
  const type = MIME[ext] || "image/jpeg";
  if (url.startsWith("/api/media/")) {
    const file = path.basename(url);
    return { bytes: await fs.readFile(path.join(MEDIA_DIR, file)), type };
  }
  // public klasöründeki dosya (ör. /luna.jpg)
  const safe = path.normalize(url).replace(/^(\.\.[/\\])+/, "");
  return { bytes: await fs.readFile(path.join(process.cwd(), "public", safe)), type };
}

/** Görseli Replicate'e gönderilebilecek data URL'ye çevirir. */
export async function toDataUrl(url: string) {
  if (url.startsWith("data:")) return url;
  const { bytes, type } = await loadImage(url);
  return `data:${type};base64,${bytes.toString("base64")}`;
}
