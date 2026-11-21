import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { characters, posts } = schema;

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
  console.log("Seed tamam: Luna hazır 💜");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
