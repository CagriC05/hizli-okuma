# Hızlı Okuma

EPUB kitapları **RSVP** (Rapid Serial Visual Presentation) ile okuma uygulaması: kelimeler ekranın
ortasında tek tek akar, göz satır boyunca gezmez. Bağımlılıksız PWA: derleme adımı yok, çevrimdışı
çalışır, telefona uygulama olarak kurulabilir.

## Okuma

- **Odak harfi (ORP):** Her kelimenin tanıma noktası (uzunluğa göre 1.–5. harf) kırmızı ve hep aynı
  noktada durur; kelime ona göre kaydırılır. Taşan uzun kelimeler küçültülür.
- **Akıllı süre:** Kelime harf sayısıyla orantılı kalır (12 harf ≈ 5 harfin 1,5 katı); sayı, virgül, nokta ve paragraf sonu biraz daha uzun kalır.
  Süreler kitap genelinde normalize edilir; 400 kel/dk seçildiyse kitap gerçekten ~400 ile akar.
- **Yumuşak başlangıç:** Başlatınca ilk birkaç kelime yavaştan hızlanır.
- **Durunca paragraf:** Durdurunca bulunduğun paragraf (öncesi ve sonrasıyla) açılır, okunan kelime
  vurgulanır. Herhangi bir kelimeye dokununca oraya atlanır; vurgulu kelimeye dokununca devam eder.
- **Cümle başından devam:** Durup başlatınca yarım kalan cümle baştan gelir (ayarlardan kapatılır;
  bilerek bir kelimeye atladıysan uygulanmaz).
- **Gezinme:** ⇤ önceki paragraf · ‹ önceki cümle · › sonraki cümle · ⇥ sonraki paragraf.
  Sahnede yatay kaydırma cümle geri/ileri, dokunma başlat/durdur. Alttaki çubukla kitapta istenen yere,
  ☰ ile bölüme gidilir. Bölüm ve kitap için kalan süre seçili hıza göre gösterilir.
- **Yazı boyu:** Alttaki küçük/büyük A düğmeleriyle 24–72 px arası (ayarlarda da var).
- **Ekran açık kalır** okurken (Wake Lock). Uygulamadan çıkınca okuma durur, konum kaydedilir.
- **İstatistik:** Bugün okunan kelime ve süre, gün serisi, ortalama gerçek hız.

Klavye: boşluk başlat/durdur · ←/→ cümle · Shift+←/→ paragraf · ↑/↓ hız · +/− yazı boyu · Esc kitaplık.

## Kitap ekleme

İlk açılışta kitaplıkta **Gözün Durduğu Yer** adlı kısa bir örnek kitap bulunur: uygulamanın nasıl
kullanılacağını anlatır; dipnot ve sayfa numarası içerdiği için temizleme kurallarını da gösterir.
Silinirse bir daha kendiliğinden eklenmez; kitaplık boşken "Örnek kitabı ekle" ile geri gelir.
Kitap `araclar/ornek_kitap.py` ile üretilir.

"＋ EPUB ekle" ile dosya seçilir. Uygulama telefona kurulduysa dosya yöneticisinde EPUB'a uzun basıp
**Paylaş → Hızlı Okuma** da çalışır (Android). DRM'li (şifreli) EPUB'lar açılmaz.

Metin çıkarılırken dipnot bağlantıları, dipnot/son not blokları, betik ve stil atılır; başlıklar
korunur ve biraz daha uzun gösterilir. İçindekiler EPUB 3 `nav` ya da EPUB 2 `toc.ncx`'ten okunur;
ikisi de yoksa her belgenin ilk başlığı bölüm adı olur.

## Çalıştırma

```bash
python3 -m http.server 8090
```

Sonra `http://localhost:8090`. Çevrimdışı çalışma, "ana ekrana ekle" ve paylaşım hedefi için HTTPS gerekir
(ör. GitHub Pages).

## Dosyalar

| Dosya | İş |
|---|---|
| `epub.js` | Zip okuma (`DecompressionStream`), OPF/içindekiler, XHTML'den paragraf çıkarma |
| `metin.js` | Kelimelere bölme, göreli süre, odak harfi, cümle/paragraf sınırları, kalan süre |
| `depo.js` | Kitaplar IndexedDB'de; konum, ayar ve günlük istatistik localStorage'da |
| `app.js` | Yönlendirme, kitaplık, okuyucu döngüsü, paragraf paneli, bölüm ve ayar kutuları |
| `ornek.epub`, `araclar/ornek_kitap.py` | Örnek kitap ve onu üreten betik |
| `sw.js` | Çevrimdışı önbellek ve Android paylaşım hedefi |
| `styles.css` | Mobil öncelikli koyu tema |

## Veri

Kitaplar ve okuma konumu yalnızca bu cihazın tarayıcısında durur; hiçbir şey sunucuya gönderilmez.
Tarayıcı verisi silinirse kitapların yeniden eklenmesi gerekir.
