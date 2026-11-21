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

## Teknoloji

- **Next.js 15** (App Router, Server Actions) + **TypeScript** + **Tailwind CSS 4**
- **Drizzle ORM + libSQL**: yerelde SQLite dosyası, canlıda [Turso](https://turso.tech)
- **Claude (Anthropic API)**: fikir ve caption üretimi
- **Replicate (FLUX 1.1 Pro)**: görsel üretimi
- **Instagram Graph API**: otomatik paylaşım

API anahtarları yoksa uygulama **demo modunda** çalışır: örnek metin ve yer tutucu görsel üretir, paylaşımları gerçekten göndermeden "paylaşıldı" olarak işaretler.

## Kurulum

```bash
npm install
cp .env.example .env      # anahtarları doldur (boş bırakırsan demo modu)
npm run setup             # veritabanı tablolarını oluşturur ve Luna'yı ekler
npm run dev               # http://localhost:3000
```

Yerelde `ADMIN_PASSWORD` boşsa panel parolasız açılır. Canlıda parola **zorunludur**; tanımlı değilse panel kilitli kalır.

## Ortam değişkenleri

| Değişken | Ne işe yarar |
|---|---|
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | Yerelde `file:./data.db`, canlıda Turso adresi ve token |
| `ADMIN_PASSWORD` | Panel giriş parolası |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Metin üretimi |
| `REPLICATE_API_TOKEN`, `REPLICATE_IMAGE_MODEL` | Görsel üretimi |
| `REPLICATE_KONTEXT_MODEL`, `REPLICATE_TRAINER` | Referanslı üretim ve LoRA eğitimi modelleri (varsayılanlar yeterli) |
| `INSTAGRAM_ACCESS_TOKEN` | Instagram paylaşımı (karakter ayarlarına Instagram kullanıcı ID'si de girilmeli) |
| `PUBLIC_BASE_URL` | Sitenin canlı adresi; Instagram görselleri bu adresten çeker |
| `CRON_SECRET` | `/api/cron/publish` uç noktasını korur |
| `MEDIA_DIR` | Üretilen görsellerin saklandığı klasör |

## Otomatik paylaşım

Planlanan gönderiler `/api/cron/publish` çağrıldığında paylaşılır. Aynı çağrı devam eden LoRA eğitimlerinin durumunu da günceller. Bu adresi 5-10 dakikada bir çağıran bir zamanlayıcı kur, örneğin [cron-job.org](https://cron-job.org) veya sunucuda crontab:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://SITEN/api/cron/publish
```

Instagram için gerekenler:
1. Instagram hesabı **Business** veya **Creator** olmalı ve bir Facebook sayfasına bağlı olmalı.
2. Meta for Developers'ta bir uygulama oluştur, `instagram_content_publish` izniyle uzun ömürlü bir access token al.
3. Token'ı `INSTAGRAM_ACCESS_TOKEN`, hesabın Instagram kullanıcı ID'sini de karakter ayarlarına gir.

## Yayına alma notları

- Üretilen görseller varsayılan olarak `MEDIA_DIR` klasörüne kaydedilir ve `/api/media/...` adresinden sunulur. Bu, kalıcı diski olan sunucularda (VPS, Railway, Render vb.) olduğu gibi çalışır. Vercel gibi kalıcı diski olmayan ortamlarda `src/lib/media.ts` dosyasını S3, Cloudflare R2 veya Supabase Storage'a yazacak şekilde değiştirmek gerekir.
- Vercel'de veritabanı olarak Turso kullan (`DATABASE_URL=libsql://...`), ardından `npm run db:push` ve `npm run db:seed` komutlarını bir kez çalıştır.

## Yol haritası

- [ ] Görseller için kalıcı depolama (R2 / Supabase Storage)
- [x] Referans fotoğrafla yüz tutarlılığı (FLUX Kontext) ve LoRA eğitimi
- [ ] Reels / video üretimi
- [ ] TikTok paylaşımı
- [ ] Yorumlara karakter ağzından AI yanıt
- [ ] Etkileşim istatistikleri
