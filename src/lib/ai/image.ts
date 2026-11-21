import type { Character } from "@/db/schema";

// Görsel üretim Replicate üzerinden yapılır (varsayılan: FLUX 1.1 Pro).
// REPLICATE_API_TOKEN yoksa demo modunda yer tutucu görsel döner.
const MODEL = process.env.REPLICATE_IMAGE_MODEL || "black-forest-labs/flux-1.1-pro";

export const imageAiEnabled = () => Boolean(process.env.REPLICATE_API_TOKEN);

/** Karakterin sabit görünüş tarifini sahneyle birleştirir; tutarlılığın anahtarı bu. */
export function buildImagePrompt(c: Character, scene: string) {
  return `Photorealistic Instagram influencer photo of the same woman in every image: ${c.appearance}. Scene: ${scene}. High detail, natural skin texture, 4:5 portrait composition.`;
}

export async function generateImage(c: Character, scene: string): Promise<string> {
  const prompt = buildImagePrompt(c, scene);
  if (!imageAiEnabled()) return demoImage(c, scene);

  const res = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      Prefer: "wait=60",
    },
    body: JSON.stringify({
      input: { prompt, aspect_ratio: "4:5", output_format: "jpg", safety_tolerance: 2 },
    }),
  });
  if (!res.ok) throw new Error(`Replicate hatası: ${res.status} ${await res.text()}`);
  let prediction = await res.json();

  // Prefer:wait süresinde bitmediyse bitene kadar yokla
  const deadline = Date.now() + 120_000;
  while (!["succeeded", "failed", "canceled"].includes(prediction.status)) {
    if (Date.now() > deadline) throw new Error("Görsel üretimi zaman aşımına uğradı");
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(prediction.urls.get, {
      headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
    });
    prediction = await poll.json();
  }
  if (prediction.status !== "succeeded") throw new Error(prediction.error || "Görsel üretilemedi");
  const out = prediction.output;
  return Array.isArray(out) ? out[0] : out;
}

function demoImage(c: Character, scene: string) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const words = esc(scene).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).length > 34) {
      lines.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  const text = lines
    .slice(0, 6)
    .map((l, i) => `<tspan x="400" dy="${i === 0 ? 0 : 44}">${l}</tspan>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#f472b6"/></linearGradient></defs>
<rect width="800" height="1000" fill="url(#g)"/>
<text x="400" y="380" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#fff" opacity=".8">DEMO GÖRSEL · ${esc(c.name)}</text>
<text x="400" y="470" text-anchor="middle" font-family="sans-serif" font-size="34" fill="#fff">${text}</text>
<text x="400" y="940" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#fff" opacity=".7">Gerçek görsel için REPLICATE_API_TOKEN ekle</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
