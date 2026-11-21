import Anthropic from "@anthropic-ai/sdk";
import type { Character } from "@/db/schema";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

export const textAiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

function systemPrompt(c: Character) {
  return `Sen "${c.name}" adlı sanal bir influencer'ın içerik yazarısın. ${c.name} adına, onun ağzından yazarsın.

Karakter:
- İsim: ${c.name} (${c.handle})
- Şehir: ${c.city}
- Alan: ${c.niche}
- Bio: ${c.bio}
- Kişilik ve ton: ${c.personality}
- Yazım kuralları: ${c.voiceRules}

Her zaman karakterin sesini koru. Yalnızca istenen formatta yanıt ver.`;
}

// Model yanıttan önce kısa bir düşünme adımı yapabildiği için token sınırı geniş tutulur.
const MIN_TOKENS = 4000;

async function ask(c: Character, prompt: string, maxTokens = MIN_TOKENS) {
  const client = new Anthropic();
  let limit = Math.max(maxTokens, MIN_TOKENS);
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: limit,
      system: systemPrompt(c),
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    // Yanıt yarıda kesildiyse daha geniş sınırla bir kez daha dene
    if (res.stop_reason !== "max_tokens" || attempt === 1) return text;
    limit *= 2;
  }
  return "";
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/```(?:json)?/gi, "");
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
  if (start < 0 || end <= start) throw new Error("AI yanıtı okunamadı, tekrar dene");
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    throw new Error("AI yanıtı okunamadı, tekrar dene");
  }
}

/** Karakterin sesiyle JSON yanıt ister. */
export async function askJson<T>(c: Character, prompt: string, maxTokens = MIN_TOKENS): Promise<T> {
  return parseJson<T>(await ask(c, prompt, maxTokens));
}

export async function generateIdeas(c: Character, count = 5, theme = ""): Promise<string[]> {
  if (!textAiEnabled()) return demoIdeas(c).slice(0, count);
  const raw = await ask(
    c,
    `${c.name} için ${count} adet Instagram gönderi fikri üret.${
      theme ? ` Tema: ${theme}.` : ""
    } Her fikir tek cümle olsun ve fotoğraflanabilir bir sahne içersin. Sadece JSON string dizisi döndür: ["...", "..."]`
  );
  return parseJson<string[]>(raw).slice(0, count);
}

export type CaptionResult = { caption: string; hashtags: string; imagePrompt: string };

export async function generateCaption(c: Character, idea: string): Promise<CaptionResult> {
  if (!textAiEnabled()) return demoCaption(c, idea);
  const raw = await ask(
    c,
    `Şu fikir için bir Instagram gönderisi yaz: "${idea}"

JSON döndür:
{
  "caption": "${c.name}'nın ağzından, yazım kurallarına uygun gönderi metni (\\n ile paragraflar)",
  "hashtags": "#etiket1 #etiket2 ... (6-10 adet, Türkçe ve İngilizce karışık)",
  "imagePrompt": "Görsel üretim modeli için İNGİLİZCE, detaylı sahne tarifi: mekan, kıyafet, poz, ışık, kamera açısı. Karakterin fiziksel tarifini YAZMA, o otomatik eklenecek."
}`
  );
  return parseJson<CaptionResult>(raw);
}

// ---------- Demo modu (API anahtarı yokken) ----------

function demoIdeas(c: Character): string[] {
  return [
    `${c.city}'da sabah kahvesi eşliğinde günün kombinini gösteriyor`,
    "Akşam rutini: cilt bakımı adımlarını aynanın karşısında anlatıyor",
    "Hafta sonu Karaköy sokaklarında sonbahar kombiniyle yürüyüş",
    "Yeni aldığı rujları deniyor ve en sevdiğini seçiyor",
    "Boğaz manzaralı bir kafede kitap okuyup dinleniyor",
    "Gardırop düzenleme günü: favori 3 parçasını tanıtıyor",
  ];
}

function demoCaption(c: Character, idea: string): CaptionResult {
  return {
    caption: `Günaydın arkadaşlar! 💜\n\nBugün sizinle küçük bir anımı paylaşmak istedim: ${idea.charAt(0).toLowerCase() + idea.slice(1)}.\n\nSiz olsanız hangisini seçerdiniz? Yorumlarda buluşalım ✨\n\nÖpüyorum! 💋`,
    hashtags: `#${c.name.toLowerCase()} #${c.city.toLowerCase().replace(/[^a-zçğıöşü]/g, "")} #moda #güzellik #lifestyle #ootd #günlük`,
    imagePrompt: `Instagram lifestyle photo, scene: ${idea}. Warm natural light, shallow depth of field, 50mm lens, candid smile.`,
  };
}
