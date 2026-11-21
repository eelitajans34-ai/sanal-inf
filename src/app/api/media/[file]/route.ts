import { promises as fs } from "fs";
import path from "path";
import { MEDIA_DIR } from "@/lib/media";

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^[\w-]+\.(jpg|png|webp)$/.test(file)) return new Response("Bulunamadı", { status: 404 });
  try {
    const buf = await fs.readFile(path.join(MEDIA_DIR, file));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": file.endsWith(".png") ? "image/png" : file.endsWith(".webp") ? "image/webp" : "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Bulunamadı", { status: 404 });
  }
}
