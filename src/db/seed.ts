import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import lunaTemplates from "./luna-templates.json";

const { characters, posts, sceneTemplates, trainingImages } = schema;

type TemplateSeed = {
  id: string;
  source: "photo" | "idea";
  title: string;
  scene: string;
  shot: "close" | "medium" | "full";
  expression: string;
  outfit: string;
  presets: string[];
  talkable: boolean;
  training: boolean;
  imageUrl: string;
  frameUrl: string;
};

const LUNA_REFERENCE = "/characters/luna/photos/yatak-odasi-yakin.jpg";

async function main() {
  let [luna] = await db.select().from(characters).where(eq(characters.slug, "luna"));
  if (!luna) {
    [luna] = await db
      .insert(characters)
      .values({
        slug: "luna",
        name: "Luna",
        handle: "@luna.istanbul",
        city: "İstanbul",
        niche: "Moda, güzellik ve günlük hayat",
        bio: "İstanbul'da yaşıyorum. Moda, güzellik ve günlük hayatımdan kesitleri sizinle paylaşıyorum 💜",
        personality:
          "Sıcak, samimi, enerjik ve pozitif. Takipçilerine 'arkadaşlar' diye hitap eder, onlarla bir arkadaşıyla konuşur gibi konuşur. Kısa, akıcı cümleler kurar. İçtenlikle heyecanlanır, takipçilerini sürece dahil eder.",
        voiceRules:
          "Türkçe yaz. Kısa paragraflar, aralarında boş satır. 2-4 emoji kullan, 💜 en sevdiği emoji. Gönderiyi çoğunlukla 'Öpüyorum! 💋' ile bitirir. Gerektiğinde takip etme / yorum yapma çağrısı yapar. Asla kaba, siyasi veya tartışmalı konulara girmez.",
        appearance:
          "25-year-old woman, very long wavy dark brown hair with caramel balayage ends, hazel-green eyes, warm olive skin, wide genuine smile, natural makeup, slim build. Warm, cozy, stylish lighting.",
        avatarUrl: "/luna.jpg",
      })
      .returning();
  }

  const existing = await db.select().from(posts).where(eq(posts.characterId, luna.id)).limit(1);
  if (existing.length === 0) {
    await db.insert(posts).values({
      characterId: luna.id,
      idea: "Tanışma gönderisi",
      caption:
        "Merhaba arkadaşlar! 💜 Ben Luna.\n\nİstanbul'da yaşıyorum. Moda, güzellik ve günlük hayatımdan kesitleri sizinle paylaşacağım.\n\nBeni takip etmeyi unutmayın. Birlikte çok güzel şeyler yapacağız!\n\nÖpüyorum! 💋",
      hashtags: "#luna #istanbul #moda #güzellik #lifestyle",
      imageUrl: "/luna.jpg",
      status: "PUBLISHED",
      publishedAt: new Date(),
    });
  }
  // Sahne şablonları (fotoğraflar + kolaj fikirleri): eklenir veya güncellenir
  for (const t of lunaTemplates as TemplateSeed[]) {
    const values = {
      characterId: luna.id,
      key: t.id,
      source: t.source,
      title: t.title,
      scene: t.scene,
      shot: t.shot,
      expression: t.expression,
      outfit: t.outfit,
      presets: t.presets,
      talkable: t.talkable,
      imageUrl: t.imageUrl,
      frameUrl: t.frameUrl,
    };
    await db
      .insert(sceneTemplates)
      .values(values)
      .onConflictDoUpdate({ target: [sceneTemplates.characterId, sceneTemplates.key], set: values });
  }

  // Yüksek çözünürlüklü referans fotoğraf (Kontext için)
  if (!luna.referenceImageUrl) {
    await db.update(characters).set({ referenceImageUrl: LUNA_REFERENCE }).where(eq(characters.id, luna.id));
  }

  // LoRA eğitim seti: seçilmiş gerçek fotoğraflar (daha önce eklenmediyse)
  for (const t of (lunaTemplates as TemplateSeed[]).filter((x) => x.source === "photo" && x.training)) {
    const exists = await db
      .select({ id: trainingImages.id })
      .from(trainingImages)
      .where(and(eq(trainingImages.characterId, luna.id), eq(trainingImages.imageUrl, t.imageUrl)))
      .limit(1);
    if (exists.length === 0) {
      await db.insert(trainingImages).values({ characterId: luna.id, imageUrl: t.imageUrl, scene: t.scene, selected: true });
    }
  }

  const n = (lunaTemplates as TemplateSeed[]).length;
  console.log(`Seed tamam: Luna hazır 💜 (${n} sahne şablonu)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
