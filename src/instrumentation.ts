// Uygulama başlarken arka plan işçisini başlatır (yalnızca Node.js çalışma ortamında).
// Kapatmak için: WORKER=off
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./worker-start");
  }
}
