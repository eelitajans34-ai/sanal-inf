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
    const ext = (res.headers.get("content-type") || "").includes("png") ? "png" : "jpg";
    const name = `${crypto.randomUUID()}.${ext}`;
    await fs.mkdir(MEDIA_DIR, { recursive: true });
    await fs.writeFile(path.join(MEDIA_DIR, name), buf);
    return `/api/media/${name}`;
  } catch {
    return url;
  }
}
