import type { Character } from "@/db/schema";
import { replicateEnabled, runPrediction } from "./replicate";
import { replicateInput } from "./inputs";

// Görsel üretim stratejisi (en tutarlıdan en serbeste):
//  1. LoRA  — karakter için eğitilmiş model varsa (en iyi yüz tutarlılığı)
//  2. Kontext — referans fotoğraftan kimliği koruyarak yeni sahne üretir (tek fotoğraf yeter)
//  3. Metin  — sadece görünüş tarifiyle FLUX 1.1 Pro (yüz her seferinde biraz değişir)
const TEXT_MODEL = process.env.REPLICATE_IMAGE_MODEL || "black-forest-labs/flux-1.1-pro";
const KONTEXT_MODEL = process.env.REPLICATE_KONTEXT_MODEL || "black-forest-labs/flux-kontext-pro";

export const imageAiEnabled = replicateEnabled;

export type ImageMode = "lora" | "reference" | "text";

export function imageMode(c: Character): ImageMode {
  if (c.loraVersion && c.loraTrigger) return "lora";
  if (c.referenceImageUrl || c.avatarUrl) return "reference";
  return "text";
}

export const IMAGE_MODE_LABEL: Record<ImageMode, string> = {
  lora: "Eğitilmiş model (LoRA)",
  reference: "Referans fotoğraf (Kontext)",
  text: "Sadece tarif",
};

export async function generateImage(
  c: Character,
  scene: string,
  opts: { mode?: ImageMode; aspect?: "4:5" | "9:16" } = {}
): Promise<string> {
  const mode = opts.mode ?? imageMode(c);
  const aspect = opts.aspect ?? "4:5";
  if (!imageAiEnabled()) return demoImage(c, scene, mode);

  if (mode === "lora") {
    const version = c.loraVersion.split(":").pop()!;
    return runPrediction("/predictions", {
      version,
      input: {
        prompt: `photo of ${c.loraTrigger} woman, ${scene}. Photorealistic Instagram influencer photo, natural skin texture, high detail.`,
        aspect_ratio: aspect,
        output_format: "jpg",
        num_outputs: 1,
        lora_scale: 1,
        guidance_scale: 3,
        num_inference_steps: 28,
        model: "dev",
      },
    });
  }

  if (mode === "reference") {
    const ref = c.referenceImageUrl || c.avatarUrl;
    return runPrediction(`/models/${KONTEXT_MODEL}/predictions`, {
      input: {
        prompt: `Keep the exact same woman from the reference photo: identical face, facial features, eye color, skin tone and long wavy hair. New photo of her: ${scene}. Change the background, outfit and pose to fit the scene. Photorealistic Instagram influencer photo, natural light, high detail.`,
        input_image: await replicateInput(ref),
        aspect_ratio: aspect,
        output_format: "jpg",
        safety_tolerance: 2,
      },
    });
  }

  return runPrediction(`/models/${TEXT_MODEL}/predictions`, {
    input: {
      prompt: `Photorealistic Instagram influencer photo of a woman: ${c.appearance}. Scene: ${scene}. High detail, natural skin texture, vertical portrait composition.`,
      aspect_ratio: aspect,
      output_format: "jpg",
      safety_tolerance: 2,
    },
  });
}

function demoImage(c: Character, scene: string, mode: ImageMode) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  const hue = [...scene].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,55%)"/><stop offset="1" stop-color="#f472b6"/></linearGradient></defs>
<rect width="800" height="1000" fill="url(#g)"/>
<text x="400" y="330" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#fff" opacity=".8">DEMO GÖRSEL · ${esc(c.name)}</text>
<text x="400" y="380" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#fff" opacity=".7">${esc(IMAGE_MODE_LABEL[mode])}</text>
<text x="400" y="470" text-anchor="middle" font-family="sans-serif" font-size="34" fill="#fff">${text}</text>
<text x="400" y="940" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#fff" opacity=".7">Gerçek görsel için REPLICATE_API_TOKEN ekle</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
