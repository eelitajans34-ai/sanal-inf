import { zipSync } from "fflate";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Character } from "@/db/schema";
import { generateImage } from "./image";
import { replicateEnabled, rexists, rget, rpost, uploadFile } from "./replicate";
import { loadImage, persistRemoteImage } from "@/lib/media";

const { characters, trainingImages } = schema;

const TRAINER = process.env.REPLICATE_TRAINER || "ostris/flux-dev-lora-trainer";
export const MIN_TRAINING_IMAGES = 10;
export const RECOMMENDED_TRAINING_IMAGES = 15;

/**
 * Eğitim seti için çeşitli sahneler. LoRA'nın karakteri iyi öğrenmesi için
 * farklı açı, ifade, ışık, kıyafet ve mekânlar; saç ve yaş sabit kalmalı.
 */
export const DATASET_SCENES = [
  "close-up headshot portrait, looking straight at the camera, soft smile, plain light grey studio background",
  "close-up portrait, three-quarter view facing left, natural window light, neutral background",
  "side profile portrait facing right, golden hour sunlight, outdoors",
  "laughing candidly, eyes slightly closed, sitting in a cozy Istanbul café with a coffee cup",
  "walking on a cobblestone street in Karaköy, Istanbul, casual chic autumn outfit, full body",
  "mirror selfie in a stylish bedroom, holding a phone, casual outfit",
  "sitting by the Bosphorus with the Galata Tower in the background, sunset, upper body",
  "wearing an elegant black evening dress at a rooftop restaurant at night, warm bokeh lights",
  "morning skincare routine in a bright bathroom, white robe, hair loose, close-up",
  "wearing a cream knit sweater, sitting on a sofa reading a book, soft lamp light",
  "serious, confident expression, editorial fashion portrait, beige trench coat, city background",
  "on a sunny beach in Bodrum, white summer dress, wind in her hair, upper body",
  "shopping in Nişantaşı, holding shopping bags, smiling over her shoulder",
  "applying lipstick in front of a vanity mirror, close-up, warm light",
  "sitting at a desk with a laptop, wearing glasses, focused, home office",
  "in a flower market holding a bouquet of tulips, cheerful expression",
  "low angle full body shot, denim jacket and white sneakers, modern building background",
  "looking up and to the left, thoughtful expression, overcast soft light, close-up",
  "cooking in a modern kitchen, apron, laughing, medium shot",
  "winter look with a scarf and wool coat, light snow falling, Istanbul street, upper body",
];

export async function listTrainingImages(characterId: string) {
  return db.query.trainingImages.findMany({
    where: eq(trainingImages.characterId, characterId),
    orderBy: (t, { asc }) => asc(t.createdAt),
  });
}

/** Henüz kullanılmamış sahnelerden `count` tane aday görsel üretir. */
export async function generateVariations(c: Character, count: number) {
  const existing = await listTrainingImages(c.id);
  const used = new Set(existing.map((t) => t.scene));
  const scenes = DATASET_SCENES.filter((s) => !used.has(s)).slice(0, count);
  if (scenes.length === 0) throw new Error("Tüm hazır sahneler kullanıldı; beğenmediklerini silip tekrar üretebilirsin.");

  const created = [];
  for (const scene of scenes) {
    const url = await persistRemoteImage(await generateImage(c, scene, { mode: "reference" }));
    const [row] = await db
      .insert(trainingImages)
      .values({ characterId: c.id, imageUrl: url, scene, selected: true })
      .returning();
    created.push(row);
  }
  return created;
}

export function triggerWordFor(c: Character) {
  return `${c.slug.replace(/[^a-z0-9]/g, "")}tok`.toUpperCase();
}

/** Seçili görsellerle Replicate'te LoRA eğitimi başlatır. */
export async function startTraining(c: Character) {
  if (!replicateEnabled()) throw new Error("Eğitim için REPLICATE_API_TOKEN gerekli.");
  if (["starting", "processing"].includes(c.trainingStatus)) throw new Error("Zaten devam eden bir eğitim var.");

  const selected = await db.query.trainingImages.findMany({
    where: and(eq(trainingImages.characterId, c.id), eq(trainingImages.selected, true)),
  });
  const sources = [
    ...[c.referenceImageUrl || c.avatarUrl].filter(Boolean).map((url) => ({ url, scene: "portrait photo" })),
    ...selected.map((t) => ({ url: t.imageUrl, scene: t.scene })),
  ];
  const usable = sources.filter((s) => !s.url.startsWith("data:image/svg"));
  if (usable.length < MIN_TRAINING_IMAGES) {
    throw new Error(`En az ${MIN_TRAINING_IMAGES} gerçek fotoğraf gerekli (şu an ${usable.length}).`);
  }

  const trigger = c.loraTrigger || triggerWordFor(c);

  // 1) Görselleri ve açıklamalarını zip'le
  const files: Record<string, Uint8Array> = {};
  for (const [i, s] of usable.entries()) {
    const { bytes, type } = await loadImage(s.url);
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const n = String(i + 1).padStart(2, "0");
    files[`${n}.${ext}`] = new Uint8Array(bytes);
    files[`${n}.txt`] = new TextEncoder().encode(`photo of ${trigger} woman, ${s.scene}`);
  }
  const zip = zipSync(files, { level: 0 });
  const inputImages = await uploadFile(zip, `${c.slug}-dataset.zip`, "application/zip");

  // 2) Hedef modeli hazırla (Replicate hesabında özel model)
  const account = await rget<{ username: string }>("/account");
  const modelName = `${c.slug}-lora`.replace(/[^a-z0-9-]/g, "-");
  if (!(await rexists(`/models/${account.username}/${modelName}`))) {
    await rpost("/models", {
      owner: account.username,
      name: modelName,
      visibility: "private",
      hardware: "gpu-h100",
      description: `${c.name} sanal influencer LoRA modeli`,
    });
  }

  // 3) Eğitimi başlat
  const trainer = await rget<{ latest_version: { id: string } }>(`/models/${TRAINER}`);
  const training = await rpost<{ id: string; status: string }>(
    `/models/${TRAINER}/versions/${trainer.latest_version.id}/trainings`,
    {
      destination: `${account.username}/${modelName}`,
      input: {
        input_images: inputImages,
        trigger_word: trigger,
        steps: 1000,
        lora_rank: 16,
        learning_rate: 0.0004,
        batch_size: 1,
        resolution: "512,768,1024",
        autocaption: false,
      },
    }
  );

  await db
    .update(characters)
    .set({ loraTrigger: trigger, trainingId: training.id, trainingStatus: training.status, trainingError: "" })
    .where(eq(characters.id, c.id));
  return training;
}

/** Eğitim durumunu Replicate'ten çeker; bittiyse modeli karaktere bağlar. */
export async function refreshTraining(c: Character) {
  if (!c.trainingId || !replicateEnabled()) return c;
  const t = await rget<{ status: string; error?: string; output?: { version?: string } }>(
    `/trainings/${c.trainingId}`
  );
  const update: Partial<Character> = { trainingStatus: t.status, trainingError: t.error || "" };
  if (t.status === "succeeded" && t.output?.version) update.loraVersion = t.output.version;
  const [updated] = await db.update(characters).set(update).where(eq(characters.id, c.id)).returning();
  return updated;
}

/** Devam eden tüm eğitimleri yokla (cron'dan çağrılır). */
export async function refreshAllTrainings() {
  const rows = await db.query.characters.findMany();
  const active = rows.filter((c) => ["starting", "processing"].includes(c.trainingStatus));
  for (const c of active) await refreshTraining(c).catch((e) => console.error(e));
  return active.length;
}
