import { spawn } from "child_process";
import { existsSync } from "fs";

/** Sıra: FFMPEG_PATH → ffmpeg-static paketi → sistemdeki ffmpeg */
function ffmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require("ffmpeg-static") as string | null;
    if (p && existsSync(p)) return p;
  } catch {}
  return "ffmpeg";
}

export function ffmpeg(args: string[], timeoutMs = 300_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), ["-hide_banner", "-y", ...args]);
    let err = "";
    proc.stderr.on("data", (d) => {
      err += d.toString();
      if (err.length > 200_000) err = err.slice(-100_000);
    });
    const timer = setTimeout(() => proc.kill("SIGKILL"), timeoutMs);
    proc.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`ffmpeg çalıştırılamadı: ${e.message}`));
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(err);
      else reject(new Error(`ffmpeg hata kodu ${code}: ${err.split("\n").slice(-40).join("\n")}`));
    });
  });
}

/** Medya süresini saniye cinsinden döner (ffmpeg çıktısından). */
export async function mediaDuration(file: string): Promise<number> {
  const out = await new Promise<string>((resolve) => {
    const proc = spawn(ffmpegPath(), ["-hide_banner", "-i", file]);
    let err = "";
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", () => resolve(err));
    proc.on("error", () => resolve(""));
  });
  const m = out.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

export async function hasAudioStream(file: string): Promise<boolean> {
  const out = await new Promise<string>((resolve) => {
    const proc = spawn(ffmpegPath(), ["-hide_banner", "-i", file]);
    let err = "";
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", () => resolve(err));
    proc.on("error", () => resolve(""));
  });
  return /Stream #.*Audio:/.test(out);
}
