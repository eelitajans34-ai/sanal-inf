import { promises as fs, createReadStream } from "fs";
import path from "path";
import { Readable } from "stream";
import { MEDIA_DIR, mimeFor } from "@/lib/media";

// Üretilen görsel, ses ve videoları sunar. Video oynatıcılar için Range isteklerini destekler.
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^[\w-]+\.(jpg|png|webp|mp4|mp3|wav)$/.test(file)) return new Response("Bulunamadı", { status: 404 });
  const full = path.join(MEDIA_DIR, file);

  let size: number;
  try {
    size = (await fs.stat(full)).size;
  } catch {
    return new Response("Bulunamadı", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": mimeFor(file),
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
