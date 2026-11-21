// Video motorları: aynı arayüzle farklı Replicate modelleri.
// "action" motorları başlangıç karesinden hareket üretir, "talk" motorları
// başlangıç karesi + ses kaydından dudak senkronlu konuşma videosu üretir.

export type EngineInput = {
  image: string; // data URL veya https
  audio?: string; // data URL veya https (talk)
  prompt: string;
  negativePrompt: string;
  duration: number;
};

export type Engine = {
  id: string;
  label: string;
  kind: "talk" | "action";
  model: string;
  cost: string; // yaklaşık maliyet notu
  note: string;
  input: (i: EngineInput) => Record<string, unknown>;
};

export const ENGINES: Engine[] = [
  {
    id: "omnihuman",
    label: "OmniHuman 1.5",
    kind: "talk",
    model: process.env.VIDEO_OMNIHUMAN_MODEL || "bytedance/omni-human-1.5",
    cost: "≈ ses süresine göre",
    note: "Sese göre mimik + jest; en doğal konuşma",
    input: (i) => ({ image: i.image, audio: i.audio, prompt: i.prompt }),
  },
  {
    id: "kling-avatar",
    label: "Kling Avatar v2",
    kind: "talk",
    model: process.env.VIDEO_KLING_AVATAR_MODEL || "kwaivgi/kling-avatar-v2",
    cost: "≈ ses süresine göre",
    note: "Çok iyi dudak senkronu, daha sakin beden hareketi",
    input: (i) => ({ image: i.image, audio: i.audio, prompt: i.prompt, mode: "pro" }),
  },
  {
    id: "kling",
    label: "Kling 2.5 Turbo Pro",
    kind: "action",
    model: process.env.VIDEO_KLING_MODEL || "kwaivgi/kling-v2.5-turbo-pro",
    cost: "≈ 0,35 $ / 5 sn",
    note: "Akıcı hareket, tarife sadık",
    input: (i) => ({
      start_image: i.image,
      prompt: i.prompt,
      negative_prompt: i.negativePrompt,
      duration: i.duration > 5 ? 10 : 5,
    }),
  },
  {
    id: "seedance",
    label: "Seedance 1 Pro",
    kind: "action",
    model: process.env.VIDEO_SEEDANCE_MODEL || "bytedance/seedance-1-pro",
    cost: "≈ 0,15 $ / 5 sn",
    note: "Ekonomik, 1080p",
    input: (i) => ({
      image: i.image,
      prompt: i.prompt,
      duration: Math.min(12, Math.max(3, Math.round(i.duration))),
      resolution: "1080p",
      fps: 24,
      camera_fixed: /static|tripod/i.test(i.prompt),
    }),
  },
  {
    id: "hailuo",
    label: "Hailuo 2.3",
    kind: "action",
    model: process.env.VIDEO_HAILUO_MODEL || "minimax/hailuo-2.3",
    cost: "≈ 0,50 $ / 6 sn",
    note: "Güçlü fizik (saç, kumaş)",
    input: (i) => ({
      first_frame_image: i.image,
      prompt: i.prompt,
      duration: 6,
      resolution: "1080p",
      prompt_optimizer: false,
    }),
  },
];

export const engineById = (id: string) => ENGINES.find((e) => e.id === id);
export const enginesFor = (kind: "talk" | "action") => ENGINES.filter((e) => e.kind === kind);
export const DEFAULT_ENGINE: Record<"talk" | "action", string> = { talk: "omnihuman", action: "kling" };
