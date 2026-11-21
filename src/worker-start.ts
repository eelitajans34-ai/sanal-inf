// Her dakika: klipleri ilerletir, reels'leri birleştirir, gönderileri paylaşır, günlük işleri çalıştırır.
import { ensureSettings } from "./lib/config";
import { tick } from "./lib/worker";

const g = globalThis as unknown as { __sanalInfWorker?: NodeJS.Timeout };

async function start() {
  if (process.env.WORKER === "off" || g.__sanalInfWorker) return;
  await ensureSettings();
  let busy = false;
  const run = async () => {
    if (busy) return; // önceki tur sürüyorsa bekle
    busy = true;
    try {
      const r = await tick();
      const did = r.clips + r.rendered + r.posts + r.published + r.routines.length;
      if (did || r.errors.length) {
        console.log(
          `[işçi] klip:${r.clips} birleştirme:${r.rendered} gönderi:${r.posts} paylaşım:${r.published} rutin:${r.routines.length}`,
          r.errors.length ? `hatalar: ${r.errors.join(" | ")}` : ""
        );
      }
    } catch (e) {
      console.error("[işçi]", e);
    } finally {
      busy = false;
    }
  };
  setTimeout(run, 15_000);
  g.__sanalInfWorker = setInterval(run, Number(process.env.WORKER_INTERVAL_MS) || 60_000);
  console.log("[işçi] başladı");
}

void start();
