# sanal·inf: Sanal Influencer Stüdyosu

Yapay zekâ ile sanal influencer karakterleri oluştur, onların ağzından içerik ve görsel üret, paylaşımları planla ve otomatik yayınla.

İlk karakter: **Luna** (@luna.istanbul). İstanbul'da yaşıyor; moda, güzellik ve günlük hayatını paylaşıyor. 💜

## Neler var?

| Bölüm | Adres | Açıklama |
|---|---|---|
| Tanıtım sitesi | `/`, `/k/luna` | Karakter vitrini ve her karakterin herkese açık profil sayfası |
| Panel | `/panel` | Karakter listesi, yeni karakter, karakter ayarları |
| İçerik stüdyosu | `/panel/karakter/[id]` | Fikir üret → caption yaz → görsel üret → planla / paylaş |
| Yüz tutarlılığı | `/panel/karakter/[id]/yuz` | Referans fotoğraf, eğitim seti üretimi ve LoRA eğitimi |
| Ses ve hareket | `/panel/karakter/[id]/video` | Ses kimliği, mimik/jest/hareket kütüphanesi, motor karşılaştırma ve puanlama |
| Reels | `/panel/karakter/[id]/reels` | AI senaryo → sahne klipleri → 9:16 birleştirme + Türkçe altyazı → Instagram Reels |
| Takvim | `/panel/takvim` | Aylık takvim, planlananlar, taslaklar ve hatalılar |
| Otomasyon | `/api/cron/publish` | Zamanı gelen gönderileri Instagram'a paylaşır |

**Karakter tutarlılığı:** Her karakterin *kişilik/ton*, *yazım kuralları* (ör. "Öpüyorum! 💋" imzası) ve *görünüş tarifi* alanları var. Metin üretiminde ilk ikisi her istekte kullanılır.

## Yüz tutarlılığı (aynı kız, her fotoğrafta)

Görseller üç yöntemden biriyle üretilir. Uygulama mevcut en iyi yöntemi otomatik seçer, stüdyoda elle de değiştirilebilir:

| Yöntem | Ne zaman | Tutarlılık | Maliyet (yaklaşık) |
|---|---|---|---|
| **LoRA** | Karakter için model eğitildiyse | En yüksek | ~0,03 $/görsel |
| **Referans (FLUX Kontext)** | Referans fotoğraf veya avatar varsa | Yüksek, tek fotoğraf yeter | ~0,04 $/görsel |
| **Sadece tarif** (FLUX 1.1 Pro) | Hiç fotoğraf yoksa | Düşük | ~0,04 $/görsel |

**LoRA eğitimi adımları** (`Panel → Karakter → Yüz tutarlılığı`):
1. **Varyasyon üret:** Kontext, referans fotoğraftan 20 hazır sahnede (yakın çekim, profil, kafe, sokak, gece, plaj…) yeni fotoğraflar üretir.
2. **Seç:** Yüzü farklı çıkanların seçimini kaldır veya sil. En az 10, ideal 15-18 görsel. İstersen beğendiğin bir görseli "Referans" yap.
3. **LoRA eğitimini başlat:** Görseller açıklamalarıyla birlikte zip'lenip Replicate'e yüklenir. Hesabında `<karakter>-lora` adında özel bir model oluşturulur ve `ostris/flux-dev-lora-trainer` ile eğitim başlar (~20-30 dk, ~2-3 $).
4. Eğitimin durumu "Durumu yenile" düğmesiyle ya da cron uç noktasıyla otomatik güncellenir. Bitince karakterin tüm yeni görselleri LoRA ile üretilir. Tetikleyici kelime otomatik atanır (ör. `LUNATOK`).

## Sahne şablonları (Luna'nın fotoğrafları)

`public/characters/luna/` klasöründe Luna'nın **32 yüksek çözünürlüklü fotoğrafı** ve kolajdan alınan **20 senaryo fikri** var. Etiketleri `src/db/luna-templates.json` dosyasında; `npm run db:seed` hepsini veritabanına yükler.

- **Hazır fotoğraflar:** her biri mekân, kıyafet, çekim açısı (yakın/orta/boy), ifade, "konuşmaya uygun" bilgisi ve uygun hareketlerle etiketli. Yüz algılamayla ortalanmış **9:16 kesimi** (`*-916.jpg`) doğrudan video başlangıç karesi olarak kullanılır. Görsel üretmeye gerek kalmaz ve kimlik tutarlılığı en yüksek seviyede olur.
- **Senaryo fikirleri:** kolajdaki mekân ve mimikler (göz kırpma, öpücük, dil çıkarma, şaşkınlık…). Küçük önizlemeler eğitimde kullanılmaz; seçilince sahne Luna'nın yüzüyle yeniden üretilir.
- **LoRA eğitim seti:** farklı ifadelerden seçilmiş 24 fotoğraf eğitim setine hazır olarak eklenir. Referans fotoğraf olarak yüksek çözünürlüklü `yatak-odasi-yakin.jpg` kullanılır.
- Hareket laboratuvarında ve Reels sahnelerinde şablon seçilebilir. Claude senaryoyu yazarken de hazır fotoğrafları önceliklendirerek bu şablonlardan seçer.

## Konuşan ve hareket eden karakter (video)

**Ses kimliği.** Her karakterin sabit bir sesi var (MiniMax Speech 2.6 HD, Türkçe). Ses ID'si, hız, perde ve duygu bir kez ayarlanır ve bütün videolarda aynı kalır. Hazır seslerden biri seçilebilir ya da `minimax/voice-cloning` ile klonlanan bir sesin ID'si girilebilir.

**Hareket kütüphanesi** (`src/lib/video/presets.ts`): 25 hazır hareket var, her biri modellerin en doğal sonucu verdiği biçimde yazıldı. Her tarife ortak doğallık kuralları (gerçek zamanlı hız, mikro ifadeler, göz kırpma, yüz ve kimlik sabitliği, düzgün eller) ve bir negatif tarif eklenir.
- *Konuşma:* kameraya samimi konuşma, heyecanlı anlatım, sakin konuşma, yürürken konuşma
- *Mimik:* gülümseme, kahkaha, göz kırpma, şaşırma, düşünceli bakış, öpücük, utangaç gülümseme, dudak büzme, göz kırpıp dil çıkarma
- *Jest:* el sallama, saç savurma, saçı kulağın arkasına atma, elle kalp, ürün gösterme, çeneyi ele yaslama, selfie çekerken kahkaha
- *Hareket:* kameraya yürüme, kombin dönüşü, kahve yudumlama, pencereden bakma, ayna selfiesi

**Video motorları** (`src/lib/video/engines.ts`):

| Motor | Tür | Ne için |
|---|---|---|
| OmniHuman 1.5 | Konuşma | Sese göre mimik ve jest; en doğal konuşma (varsayılan) |
| Kling Avatar v2 | Konuşma | Çok iyi dudak senkronu, daha sakin beden hareketi |
| Kling 2.5 Turbo Pro | Hareket | Akıcı hareket, tarife sadık (varsayılan) |
| Seedance 1 Pro | Hareket | Ekonomik, 1080p |
| Hailuo 2.3 | Hareket | Güçlü fizik (saç, kumaş) |

**Stabil hale getirme.** Hareket laboratuvarında bir hareket aynı başlangıç karesinden 3 motora kadar üretilir ve sonuçlar 👍/👎 ile puanlanır. Reels'lerde her hareket için en çok beğenilen motor otomatik seçilir. Başlangıç kareleri karakterin yüzüyle (LoRA veya Kontext) ve 9:16 olarak üretilir.

**Reels akışı:** Konu yazılır, Claude senaryoyu hazırlar (hook, 3-5 sahne, Türkçe replikler, gönderi metni). Senaryo düzenlenebilir. Ardından her sahne için başlangıç karesi, ses ve video üretilir. Bütün klipler hazır olunca ffmpeg ile 1080x1920 / 30 fps formatında birleştirilir; hook yazısı ve kelime kelime zamanlanmış Türkçe altyazılar videoya gömülür ve bir kapak görseli çıkarılır. Hazır video tek tıkla Instagram Reels olarak planlanabilir.

Video üretimi asenkron çalışır: klipler Replicate'te başlatılır, panel açıkken birkaç saniyede bir durumları yoklanır, biten videolar indirilip saklanır. ffmpeg için `ffmpeg-static` paketi kullanılır (altyazı için libass içerir); istenirse `FFMPEG_PATH` ile sistemdeki ffmpeg gösterilebilir.

## Teknoloji

- **Next.js 15** (App Router, Server Actions) + **TypeScript** + **Tailwind CSS 4**
- **Drizzle ORM + libSQL**: yerelde SQLite dosyası, canlıda [Turso](https://turso.tech)
- **Claude (Anthropic API)**: fikir ve caption üretimi
- **Replicate (FLUX 1.1 Pro)**: görsel üretimi
- **Instagram Graph API**: otomatik paylaşım

API anahtarları yoksa uygulama **demo modunda** çalışır: örnek metin ve yer tutucu görsel üretir, paylaşımları gerçekten göndermeden "paylaşıldı" olarak işaretler.

## Kurulum (5 dakika)

```bash
git clone https://github.com/eelitajans34-ai/sanal-inf.git
cd sanal-inf
npm install
cp .env.example .env      # ADMIN_PASSWORD'u doldur (diğerleri panelden de girilebilir)
npm run setup             # veritabanı + Luna + 52 sahne şablonu + LoRA eğitim seti
npm run dev               # http://localhost:3000/panel
```

Sonra panelde sırayla:

1. **Kurulum** sayfası: Claude ve Replicate anahtarlarını yapıştır, "Bağlantıyı test et" ile doğrula. Her servis için anahtarın nereden alınacağı adım adım yazıyor. Instagram isteğe bağlı.
2. **Luna → Ses ve hareket:** sesi seç, birkaç hareketi hazır fotoğraflarla dene ve puanla.
3. **Luna → Yüz tutarlılığı:** hazır 24 fotoğraflık setle LoRA eğitimini başlat (~20-30 dk). İsteğe bağlı ama önerilir.
4. **Luna → Günlük işler:** "Örnek planı ekle" ya da kendi işlerini tanımla. Bundan sonra uygulama açık olduğu sürece içerikler kendiliğinden üretilir.

Yerelde `ADMIN_PASSWORD` boşsa panel parolasız açılır. Canlıda parola **zorunludur**.

## Günlük işler ve arka plan işçisi

Panelden tanımlanan her iş için **gün(ler)**, **üretim saati**, **iş türü**, **konu listesi** (her çalışmada sıradaki konu, boşsa AI seçer) ve **paylaşım şekli** belirlenir:

| İş türü | Ne üretir | Gerekenler |
|---|---|---|
| Fotoğraflı gönderi | Fikir + gönderi metni + görsel (Replicate yoksa hazır fotoğraflardan biri) | Claude |
| Fotoğraf montajı | Hazır fotoğraflardan hareketli, yazılı 9:16 Reels (~15 sn'de hazır) | Claude (yoksa örnek metin) |
| Konuşan AI Reels | Senaryo + Luna'nın sesi ve konuşan/hareket eden klipleri + altyazılı video | Claude + Replicate |

Paylaşım: **"Onayıma düşsün"** seçilirse içerik takvimde taslak olarak bekler. **"Otomatik planla"** seçilirse belirtilen saatte Instagram'a gönderilir (saat geçmişse ertesi gün).

**Arka plan işçisi** (`src/lib/worker.ts`) uygulama çalıştığı sürece her dakika şunları yapar: video kliplerini ilerletir, hazır Reels'leri birleştirir, günlük işlerden gelen videolardan gönderi oluşturur, zamanı gelen gönderileri paylaşır, LoRA eğitimlerini yoklar ve zamanı gelen günlük işleri çalıştırır. Sunucusuz bir ortamda (ör. Vercel) aynı işi `GET /api/cron/tick` adresini dakikada bir çağırarak yaptırabilirsin (`Authorization: Bearer $CRON_SECRET`).

## Ortam değişkenleri

| Değişken | Ne işe yarar |
|---|---|
| *(panelden)* | Claude, Replicate, Instagram anahtarları ve herkese açık adres **Kurulum** sayfasından girilebilir; panel değerleri .env'in önüne geçer |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | Yerelde `file:./data.db`, canlıda Turso adresi ve token |
| `ADMIN_PASSWORD` | Panel giriş parolası |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Metin üretimi |
| `REPLICATE_API_TOKEN`, `REPLICATE_IMAGE_MODEL` | Görsel üretimi |
| `REPLICATE_KONTEXT_MODEL`, `REPLICATE_TRAINER` | Referanslı üretim ve LoRA eğitimi modelleri (varsayılanlar yeterli) |
| `INSTAGRAM_ACCESS_TOKEN` | Instagram paylaşımı (karakter ayarlarına Instagram kullanıcı ID'si de girilmeli) |
| `PUBLIC_BASE_URL` | Sitenin canlı adresi; Instagram görselleri bu adresten çeker |
| `CRON_SECRET` | `/api/cron/tick` uç noktasını korur |
| `WORKER`, `WORKER_INTERVAL_MS` | Arka plan işçisi (`off` ile kapatılır), çalışma aralığı |
| `MEDIA_DIR` | Üretilen görsellerin saklandığı klasör |

## Otomatik paylaşım (Instagram)

Planlanan gönderiler arka plan işçisi tarafından zamanı gelince paylaşılır. Instagram için gerekenler (Kurulum sayfasında adım adım anlatılıyor):
1. Instagram hesabı **Business** veya **Creator** olmalı ve bir Facebook sayfasına bağlı olmalı.
2. Meta for Developers'ta bir uygulama oluştur, `instagram_content_publish` izniyle uzun ömürlü bir access token al.
3. Token'ı Kurulum sayfasına yapıştır, "Bağlantıyı test et" ile bulunan Instagram hesabını tek tıkla karaktere bağla.
4. Instagram medyayı herkese açık bir adresten indirir: site yayında değilken `npx cloudflared tunnel --url http://localhost:3000` ile geçici bir adres alıp **Herkese açık adres** alanına yaz.

## Yayına alma notları

- Üretilen görseller varsayılan olarak `MEDIA_DIR` klasörüne kaydedilir ve `/api/media/...` adresinden sunulur. Bu, kalıcı diski olan sunucularda (VPS, Railway, Render vb.) olduğu gibi çalışır. Vercel gibi kalıcı diski olmayan ortamlarda `src/lib/media.ts` dosyasını S3, Cloudflare R2 veya Supabase Storage'a yazacak şekilde değiştirmek gerekir.
- Vercel'de veritabanı olarak Turso kullan (`DATABASE_URL=libsql://...`), ardından `npm run db:push` ve `npm run db:seed` komutlarını bir kez çalıştır.

## Yol haritası

- [ ] Görseller için kalıcı depolama (R2 / Supabase Storage)
- [x] Referans fotoğrafla yüz tutarlılığı (FLUX Kontext) ve LoRA eğitimi
- [x] Konuşan karakter, hareket kütüphanesi ve Reels üretimi
- [x] Kurulum sihirbazı (panelden anahtar bağlama ve test)
- [x] Fotoğraf montajı (Replicate'siz hareketli Reels)
- [x] Günlük işler ve arka plan işçisi
- [ ] Arka plan müziği
- [ ] Siteyi yayına alma (sunucu, kalıcı medya deposu)
- [ ] Ses klonlama arayüzü
- [ ] TikTok paylaşımı
- [ ] Yorumlara karakter ağzından AI yanıt
- [ ] Etkileşim istatistikleri
