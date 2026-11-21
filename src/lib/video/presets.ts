// Hareket kütüphanesi: karakterin yapabildiği mimik, jest ve hareketler.
// Her tarif modellerin en doğal sonucu verdiği şekilde yazıldı: tek ana hareket,
// gerçek zamanlı hız, küçük mikro ifadeler, sabit/el kamerası hissi.

export type PresetCategory = "konusma" | "mimik" | "jest" | "hareket";

export type MotionPreset = {
  id: string;
  label: string; // Türkçe ad
  category: PresetCategory;
  kind: "talk" | "action";
  motion: string; // İngilizce hareket tarifi
  camera: string; // kamera davranışı
};

export const CATEGORY_LABEL: Record<PresetCategory, string> = {
  konusma: "Konuşma",
  mimik: "Mimik",
  jest: "Jest",
  hareket: "Hareket",
};

export const PRESETS: MotionPreset[] = [
  // --- Konuşma (sesle dudak senkronu) ---
  {
    id: "talk-vlog",
    label: "Kameraya samimi konuşma",
    category: "konusma",
    kind: "talk",
    motion:
      "she talks to the camera like a friendly vlog, warm genuine smile, expressive eyebrows, natural blinking, small head nods and tilts that follow the rhythm of her speech, occasional small hand gestures near her chest",
    camera: "static vertical smartphone framing, medium close-up",
  },
  {
    id: "talk-excited",
    label: "Heyecanlı anlatım",
    category: "konusma",
    kind: "talk",
    motion:
      "she speaks excitedly to the camera, eyes widening with enthusiasm, bright smile, animated but natural hand gestures, slight lean toward the camera on key words, natural blinking",
    camera: "handheld selfie framing with very subtle natural shake",
  },
  {
    id: "talk-calm",
    label: "Sakin, içten konuşma",
    category: "konusma",
    kind: "talk",
    motion:
      "she speaks calmly and sincerely to the camera, soft relaxed smile, gentle head movements, slow natural blinks, hands resting, intimate and cozy mood",
    camera: "static tripod framing, close-up",
  },
  {
    id: "talk-walking",
    label: "Yürürken konuşma",
    category: "konusma",
    kind: "talk",
    motion:
      "she walks slowly toward the camera while talking to it, natural arm swing, hair moving slightly, casual confident smile, looks at the camera most of the time",
    camera: "handheld selfie camera moving backward with her, smooth",
  },

  // --- Mimik ---
  {
    id: "smile-soft",
    label: "Hafif gülümseme",
    category: "mimik",
    kind: "action",
    motion:
      "she looks into the camera and her expression slowly warms into a soft, genuine smile, cheeks lifting naturally, eyes slightly squinting with the smile, one natural blink",
    camera: "static close-up",
  },
  {
    id: "laugh",
    label: "İçten kahkaha",
    category: "mimik",
    kind: "action",
    motion:
      "she bursts into a genuine natural laugh as if someone said something funny off-camera, head tilting back slightly, shoulders shaking gently, then looks back at the camera still smiling",
    camera: "static medium close-up",
  },
  {
    id: "wink",
    label: "Göz kırpma",
    category: "mimik",
    kind: "action",
    motion:
      "she looks at the camera with a playful smile and gives a quick natural wink with one eye, then a small confident smile",
    camera: "static close-up",
  },
  {
    id: "surprised",
    label: "Şaşırıp gülme",
    category: "mimik",
    kind: "action",
    motion:
      "her eyes widen in pleasant surprise, eyebrows rise, mouth opens slightly, then she breaks into a delighted smile",
    camera: "static close-up",
  },
  {
    id: "thinking",
    label: "Düşünceli bakış",
    category: "mimik",
    kind: "action",
    motion:
      "she glances up and to the side thoughtfully, lips pressed together lightly, then looks back at the camera with a small knowing smile",
    camera: "static close-up",
  },
  {
    id: "kiss",
    label: "Öpücük gönderme",
    category: "mimik",
    kind: "action",
    motion:
      "she smiles, raises her hand to her lips and blows a gentle kiss toward the camera, then smiles warmly",
    camera: "static medium close-up",
  },

  {
    id: "shy-smile",
    label: "Utangaç gülümseme",
    category: "mimik",
    kind: "action",
    motion:
      "she glances down for a moment with a shy, sweet smile, then looks back up at the camera, bringing one hand gently near her cheek",
    camera: "static close-up",
  },
  {
    id: "pout",
    label: "Dudak büzme (öpücük pozu)",
    category: "mimik",
    kind: "action",
    motion: "she playfully purses her lips in a kiss pose toward the camera, holds it for a moment, then relaxes into a smile",
    camera: "static selfie close-up",
  },
  {
    id: "tongue-wink",
    label: "Şakacı: göz kırpıp dil çıkarma",
    category: "mimik",
    kind: "action",
    motion: "she winks and briefly sticks her tongue out playfully at the camera, then laughs naturally",
    camera: "static selfie close-up",
  },

  // --- Jest ---
  {
    id: "chin-rest",
    label: "Çenesini eline yaslama",
    category: "jest",
    kind: "action",
    motion:
      "she slowly rests her chin on her hand, looks at the camera with a calm confident gaze, then a subtle smile appears",
    camera: "static medium close-up",
  },
  {
    id: "selfie-laugh",
    label: "Selfie çekerken kahkaha",
    category: "jest",
    kind: "action",
    motion:
      "she holds the phone at arm's length taking a selfie video, laughs naturally, tilts her head and adjusts her hair slightly",
    camera: "front smartphone camera held by her extended arm, natural slight movement",
  },
  {
    id: "wave",
    label: "El sallama (selam)",
    category: "jest",
    kind: "action",
    motion: "she smiles and waves hello at the camera with one hand, relaxed natural wrist movement, friendly expression",
    camera: "static medium shot",
  },
  {
    id: "hair-flip",
    label: "Saç savurma",
    category: "jest",
    kind: "action",
    motion:
      "she runs her hand through her long hair and gently flips it over her shoulder, hair moving with realistic physics, confident smile at the camera",
    camera: "static medium shot",
  },
  {
    id: "hair-tuck",
    label: "Saçını kulağının arkasına atma",
    category: "jest",
    kind: "action",
    motion: "she shyly tucks a strand of hair behind her ear and smiles softly, looking at the camera",
    camera: "static close-up",
  },
  {
    id: "heart-hands",
    label: "Elleriyle kalp",
    category: "jest",
    kind: "action",
    motion: "she smiles and makes a heart shape with both hands in front of her chest toward the camera, holds it briefly",
    camera: "static medium shot",
  },
  {
    id: "show-product",
    label: "Ürün gösterme",
    category: "jest",
    kind: "action",
    motion:
      "she lifts the item she is holding toward the camera to show it, turns it slightly, then looks at the camera with an approving smile",
    camera: "static medium shot, focus on her and the item",
  },

  // --- Hareket ---
  {
    id: "walk-to-camera",
    label: "Kameraya doğru yürüme",
    category: "hareket",
    kind: "action",
    motion: "she walks confidently toward the camera with a natural gait and arm swing, smiling, hair moving naturally",
    camera: "camera slowly tracks backward, smooth",
  },
  {
    id: "outfit-turn",
    label: "Kombin gösterme (dönüş)",
    category: "hareket",
    kind: "action",
    motion:
      "she does a slow natural half turn to show her outfit, glances over her shoulder, then turns back facing the camera with a smile",
    camera: "static full-body vertical shot",
  },
  {
    id: "sip-coffee",
    label: "Kahve yudumlama",
    category: "hareket",
    kind: "action",
    motion: "she lifts her coffee cup, takes a small natural sip, lowers it and smiles contentedly at the camera",
    camera: "static medium close-up",
  },
  {
    id: "look-window",
    label: "Pencereden bakma",
    category: "hareket",
    kind: "action",
    motion: "she looks out of the window calmly, breathing naturally, then turns her head to the camera with a gentle smile",
    camera: "very slow push-in",
  },
  {
    id: "mirror-selfie",
    label: "Ayna selfiesi",
    category: "hareket",
    kind: "action",
    motion: "she poses for a mirror selfie holding her phone, shifts her weight to the other leg and changes her pose slightly, smiling",
    camera: "static, mirror reflection framing",
  },
];

export const presetById = (id: string) => PRESETS.find((p) => p.id === id);

/** Her video tarifine eklenen doğallık kuralları. */
export const NATURAL_RULES =
  "Realistic, natural human motion at real-time speed (not slow motion). Subtle micro-expressions and natural eye blinks. Relaxed shoulders and breathing. The woman keeps exactly the same face, identity, hair and outfit as in the first frame for the whole clip. Anatomically correct hands with five fingers. Smooth, stable, photorealistic, shot on a smartphone, vertical 9:16.";

export const NEGATIVE_PROMPT =
  "morphing face, face changing, identity change, distorted hands, extra fingers, missing fingers, warped body, flicker, jitter, stutter, slow motion, frozen face, uncanny smile, plastic skin, cartoon, blurry, low quality, text, watermark";

export function buildMotionPrompt(preset: MotionPreset, scene: string) {
  return `A young woman ${scene ? `(${scene}) ` : ""}— ${preset.motion}. Camera: ${preset.camera}. ${NATURAL_RULES}`;
}
