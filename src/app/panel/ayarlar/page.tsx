import Link from "next/link";
import { db, schema } from "@/lib/db";
import { ensureSettings, mask, setting, settingSource, type SettingKey } from "@/lib/config";
import { saveSettingAction } from "@/app/actions";
import { TestButton } from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

type Service = {
  key: SettingKey;
  title: string;
  what: string;
  required: boolean;
  placeholder: string;
  secret: boolean;
  steps: React.ReactNode[];
  cost: string;
};

const SERVICES: Service[] = [
  {
    key: "ANTHROPIC_API_KEY",
    title: "Claude (Anthropic)",
    what: "Senaryo, gönderi metni, fikir ve montaj yazıları. Karakterin üslubu buradan gelir.",
    required: true,
    placeholder: "sk-ant-…",
    secret: true,
    steps: [
      <>
        <a className="text-brand" href="https://console.anthropic.com" target="_blank" rel="noreferrer">
          console.anthropic.com
        </a>{" "}
        adresinde hesap aç / giriş yap.
      </>,
      <>Billing bölümünden kredi yükle (birkaç dolar aylarca yeter).</>,
      <>API Keys → Create Key; anahtarı kopyalayıp aşağıya yapıştır.</>,
    ],
    cost: "Gönderi metni başına ≈ 1-3 sent",
  },
  {
    key: "REPLICATE_API_TOKEN",
    title: "Replicate",
    what: "Ses (MiniMax), konuşan/hareketli video (OmniHuman, Kling, Seedance, Hailuo), görsel (FLUX) ve LoRA eğitimi.",
    required: true,
    placeholder: "r8_…",
    secret: true,
    steps: [
      <>
        <a className="text-brand" href="https://replicate.com/signin" target="_blank" rel="noreferrer">
          replicate.com
        </a>{" "}
        adresinde GitHub hesabınla giriş yap.
      </>,
      <>
        <a className="text-brand" href="https://replicate.com/account/billing" target="_blank" rel="noreferrer">
          Account → Billing
        </a>{" "}
        bölümünden ön ödemeli kredi yükle (başlangıç için 10 $). Ön ödemeli olduğu için fazlası harcanamaz.
      </>,
      <>
        <a className="text-brand" href="https://replicate.com/account/api-tokens" target="_blank" rel="noreferrer">
          API tokens
        </a>{" "}
        → Create token; <code>r8_</code> ile başlayan anahtarı yapıştır.
      </>,
    ],
    cost: "5 sn klip ≈ 0,15-0,50 $ · Reels ≈ 2-4 $ · LoRA eğitimi ≈ 2-3 $",
  },
  {
    key: "INSTAGRAM_ACCESS_TOKEN",
    title: "Instagram (otomatik paylaşım)",
    what: "Planlanan gönderi ve Reels'leri Instagram'a kendisi paylaşır. Bağlanmazsa paylaşımlar demo olarak işaretlenir, sen elle paylaşırsın.",
    required: false,
    placeholder: "EAAG…",
    secret: true,
    steps: [
      <>Instagram hesabını Ayarlar → Hesap türü ile Business veya Creator yap ve bir Facebook sayfasına bağla.</>,
      <>
        <a className="text-brand" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">
          developers.facebook.com
        </a>{" "}
        → Uygulama oluştur → &quot;Instagram Graph API&quot; ürününü ekle.
      </>,
      <>
        <a className="text-brand" href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noreferrer">
          Graph API Explorer
        </a>
        &apos;da uygulamanı seç; <code>instagram_basic</code>, <code>instagram_content_publish</code>,{" "}
        <code>pages_show_list</code>, <code>pages_read_engagement</code> izinleriyle token üret.
      </>,
      <>
        <a className="text-brand" href="https://developers.facebook.com/tools/debug/accesstoken" target="_blank" rel="noreferrer">
          Access Token Debugger
        </a>
        &apos;da &quot;Extend Access Token&quot; ile 60 günlük token al ve yapıştır. Testte çıkan Instagram hesabını
        karaktere bağla.
      </>,
    ],
    cost: "Ücretsiz",
  },
  {
    key: "PUBLIC_BASE_URL",
    title: "Herkese açık adres",
    what: "Instagram görsel ve videoyu bu adresten indirir. Sadece otomatik paylaşım için gerekir.",
    required: false,
    placeholder: "https://luna.ornek.com",
    secret: false,
    steps: [
      <>Site yayına alınınca o adresi yaz.</>,
      <>
        Bilgisayarında çalıştırırken geçici bir tünel kullanabilirsin:{" "}
        <code>npx cloudflared tunnel --url http://localhost:3000</code> → verdiği https adresini yaz.
      </>,
    ],
    cost: "Ücretsiz",
  },
];

export default async function SettingsPage() {
  await ensureSettings(true);
  const characters = await db
    .select({ id: schema.characters.id, name: schema.characters.name, instagramUserId: schema.characters.instagramUserId })
    .from(schema.characters);
  const routineCount = (await db.select({ id: schema.routines.id }).from(schema.routines)).length;
  const chars = await db.query.characters.findMany();

  const checklist = [
    { done: Boolean(setting("ANTHROPIC_API_KEY")), label: "Claude anahtarı" },
    { done: Boolean(setting("REPLICATE_API_TOKEN")), label: "Replicate anahtarı" },
    { done: chars.some((c) => c.voiceId), label: "Ses kimliği", href: chars[0] && `/panel/karakter/${chars[0].id}/video` },
    {
      done: chars.some((c) => c.loraVersion),
      label: "LoRA eğitimi (isteğe bağlı)",
      href: chars[0] && `/panel/karakter/${chars[0].id}/yuz`,
    },
    { done: routineCount > 0, label: "Günlük işler", href: chars[0] && `/panel/karakter/${chars[0].id}/gunluk` },
    { done: Boolean(setting("INSTAGRAM_ACCESS_TOKEN")), label: "Instagram (isteğe bağlı)" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl">Kurulum ve bağlantılar</h1>
        <p className="mt-1 max-w-3xl text-muted">
          Anahtarları buraya bir kez gir, uygulama gerisini halleder. Buraya girilen değerler veritabanında saklanır ve
          .env dosyasındakilerin önüne geçer. Anahtarlar ekranda maskelenir.
        </p>
      </div>

      <section className="card p-6">
        <h2 className="mb-3 font-semibold">Kurulum durumu</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {checklist.map((i) => (
            <li key={i.label} className="flex items-center gap-2 text-sm">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${i.done ? "bg-emerald-500 text-white" : "bg-line text-muted"}`}
              >
                {i.done ? "✓" : ""}
              </span>
              {i.href ? (
                <Link href={i.href} className="hover:text-brand">
                  {i.label}
                </Link>
              ) : (
                i.label
              )}
            </li>
          ))}
        </ul>
      </section>

      {SERVICES.map((s) => {
        const current = setting(s.key);
        const source = settingSource(s.key);
        return (
          <section key={s.key} className="card grid gap-6 p-6 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl">{s.title}</h2>
                {s.required ? (
                  <span className="badge bg-brand-soft text-brand">gerekli</span>
                ) : (
                  <span className="badge bg-gray-100 text-gray-700">isteğe bağlı</span>
                )}
                {current ? (
                  <span className="badge bg-emerald-100 text-emerald-800">
                    bağlı{source === "env" ? " (.env)" : ""}
                  </span>
                ) : (
                  <span className="badge bg-amber-100 text-amber-800">girilmedi</span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">{s.what}</p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                {s.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-muted">Maliyet: {s.cost}</p>
            </div>
            <div className="space-y-3">
              <form action={saveSettingAction.bind(null, s.key)} className="space-y-2">
                <label className="label" htmlFor={s.key}>
                  {s.key}
                </label>
                <input
                  id={s.key}
                  name="value"
                  type={s.secret ? "password" : "text"}
                  autoComplete="off"
                  className="input font-mono"
                  placeholder={current ? (s.secret ? mask(current) : current) : s.placeholder}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button className="btn-primary">Kaydet</button>
                  {source === "panel" && (
                    <label className="flex items-center gap-1 text-xs text-muted">
                      <input type="checkbox" name="clear" value="1" /> kayıtlı değeri sil
                    </label>
                  )}
                </div>
              </form>
              {current && (
                <TestButton settingKey={s.key} characters={s.key === "INSTAGRAM_ACCESS_TOKEN" ? characters : undefined} />
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
