import { promises as fs } from "fs";
import type { Character } from "@/db/schema";
import { replicateEnabled, runPrediction } from "@/lib/ai/replicate";
import { newMediaFile, persistRemoteFile } from "@/lib/media";
import { ffmpeg } from "./ffmpeg";

// Karakterin ses kimliği: MiniMax Speech (Replicate). Aynı voice_id + ayarlar = her videoda aynı ses.
const TTS_MODEL = process.env.REPLICATE_TTS_MODEL || "minimax/speech-2.6-hd";

/** MiniMax hazır sesleri (kadın / genç sesler önde). Klonlanmış ses ID'si de girilebilir. */
export const VOICE_PRESETS = [
  { id: "Lively_Girl", label: "Canlı genç kız" },
  { id: "Inspirational_girl", label: "İlham veren kız" },
  { id: "Lovely_Girl", label: "Tatlı kız" },
  { id: "Sweet_Girl_2", label: "Sevimli kız" },
  { id: "Exuberant_Girl", label: "Coşkulu kız" },
  { id: "Calm_Woman", label: "Sakin kadın" },
  { id: "Wise_Woman", label: "Olgun kadın" },
  { id: "Friendly_Person", label: "Samimi" },
];

export const VOICE_EMOTIONS = [
  { id: "auto", label: "Otomatik" },
  { id: "happy", label: "Mutlu" },
  { id: "neutral", label: "Nötr" },
  { id: "calm", label: "Sakin" },
  { id: "surprised", label: "Şaşkın" },
  { id: "sad", label: "Hüzünlü" },
];

export const SAMPLE_LINE =
  "Merhaba arkadaşlar! Ben Luna. Bugün size İstanbul'daki en sevdiğim kafeyi göstereceğim, hazır mısınız?";

/** Metni karakterin sesiyle seslendirir; uygulama içi mp3 adresi döner. */
export async function speak(c: Character, text: string): Promise<string> {
  if (!replicateEnabled()) return demoSpeech(text);
  const url = await runPrediction(`/models/${TTS_MODEL}/predictions`, {
    input: {
      text,
      voice_id: c.voiceId || "Lively_Girl",
      speed: c.voiceSpeed || 1,
      pitch: c.voicePitch || 0,
      emotion: c.voiceEmotion || "auto",
      language_boost: "Turkish",
      audio_format: "mp3",
      sample_rate: 44100,
    },
  });
  return persistRemoteFile(url, "mp3");
}

/** Demo: metin uzunluğuna göre süre hesaplanan, alçak bir ton + sessizlikten oluşan mp3. */
async function demoSpeech(text: string): Promise<string> {
  const words = text.trim().split(/\s+/).length;
  const seconds = Math.min(30, Math.max(2, words * 0.42));
  const { file, url } = await newMediaFile("mp3");
  await ffmpeg([
    "-f", "lavfi", "-i", `sine=frequency=220:duration=${seconds}`,
    "-af", "volume=0.04,apulsator=hz=3",
    "-ar", "44100", "-ac", "1", "-b:a", "96k", file,
  ]);
  await fs.stat(file);
  return url;
}
