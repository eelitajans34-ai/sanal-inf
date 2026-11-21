import { loadImage } from "@/lib/media";
import { uploadFile } from "./replicate";

const INLINE_LIMIT = 200 * 1024; // küçük dosyalar data URL olarak gider, büyükler Replicate'e yüklenir

/** Uygulamadaki bir medya adresini Replicate'in kabul edeceği girdiye çevirir. */
export async function replicateInput(url: string): Promise<string> {
  if (/^https:\/\//.test(url) && !url.includes("localhost")) return url;
  const { bytes, type } = await loadImage(url);
  if (bytes.length <= INLINE_LIMIT) return `data:${type};base64,${bytes.toString("base64")}`;
  const ext = type.split("/")[1]?.replace("jpeg", "jpg").replace("mpeg", "mp3") || "bin";
  return uploadFile(new Uint8Array(bytes), `input.${ext}`, type);
}
