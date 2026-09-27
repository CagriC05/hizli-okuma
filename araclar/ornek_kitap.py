"""ornek.epub üretir: uygulamanın kendini anlatan, ilk açılışta kitaplığa eklenen örnek kitap.
Metin bu depo için yazıldı. Dipnot, sayfa sonu, tek başına sayfa numarası ve diyalog içerir;
böylece temizleme kuralları da gerçek bir dosyada sınanır.  Çalıştırma: python3 araclar/ornek_kitap.py"""
import zipfile, pathlib

BOLUMLER = [
 ("Birinci Bölüm: Göz Neden Yorulur?", [
  "Bir sayfayı okuduğunu sanırsın, oysa gözün sayfa üzerinde hiç düzgün kaymaz. Küçük sıçramalar yapar, bir kelimeye takılır, sonra bir sonrakine atlar. Bu sıçramalara sakkad denir ve her biri saniyenin yirmide biri kadar sürer.",
  "Bir satırın sonuna geldiğinde göz bir kez daha büyük bir sıçrama yapar: sağdan sola, bir alt satırın başına. Bazen de geri döner, az önce okuduğu kelimeye tekrar bakar. Araştırmacılar bu geri dönüşlerin okuma süresinin önemli bir kısmını yediğini söylüyor.<sup><a href='#dn1' epub:type='noteref'>1</a></sup>",
  "Hızlı okuma uygulamaları bu yüzden başka bir yol dener. Kelimeyi gözün gittiği yere taşımak yerine, kelimeyi gözün durduğu yere getirir. Sen hep aynı noktaya bakarsın; kelimeler oraya teker teker gelir ve gider.",
  "Bu yönteme Hızlı Ardışık Görsel Sunum denir, İngilizce kısaltmasıyla RSVP. Yeni bir fikir değildir: psikologlar onu 1970'lerden beri dikkat ve algı deneylerinde kullanıyor.",
  "<span epub:type='pagebreak' id='s2' title='2'>2</span>Ortadaki kırmızı harfi fark ettin mi? Ona odak harfi diyoruz. Her kelimenin, göz tarafından en kolay tanındığı bir noktası vardır; bu nokta genellikle kelimenin tam ortası değil, biraz solundadır. Uygulama bu harfi hep aynı yere koyar, böylece gözün en ufak bir düzeltme yapmasına gerek kalmaz.",
 ]),
 ("İkinci Bölüm: Kumanda Sende", [
  "Şimdi bir deney yapalım. Ekrana bir kez dokun ve okumayı durdur.",
  "Durdurduğunda, okuduğun paragrafın tamamı açılır ve bulunduğun kelime vurgulanır. Bir cümleyi kaçırdıysan göz ucuyla bakıp nerede olduğunu anlarsın. Herhangi bir kelimeye dokunursan okuma oradan devam eder; vurgulu kelimeye dokunursan kaldığın yerden sürer.",
  "Alttaki düğmeler seni cümle cümle ya da paragraf paragraf ileri ve geri götürür. Okurken ekranı sağa ya da sola kaydırmak da aynı işi görür: sola kaydırırsan sonraki cümle, sağa kaydırırsan önceki cümle.",
  "47",
  "Hızı alttaki eksi ve artı düğmeleriyle değiştirebilirsin. Başlangıç için dakikada 300 ile 350 kelime rahat bir aralıktır. Birkaç gün sonra 450'yi, sonra 500'ü dene. Acele etme: hız, anladığın sürece anlamlıdır.",
  "Uzun kelimeler, örneğin “sorumluluklarımızdan” ya da “karşılaştırılamayacak”, biraz daha uzun süre ekranda kalır. Virgülde kısa, noktada daha uzun bir nefes verilir. Bu duraklamalar ortalama hızı bozmaz; uygulama kitabın geneline bakarak süreleri dengeler.",
 ]),
 ("Üçüncü Bölüm: Hız ve Anlam", [
  "“Peki ne kadar hızlı okuyabilirim?” diye soruyorsan, dürüst cevap şu: çoğu insan RSVP ile dakikada 500 kelimeyi rahatça görebilir, ama görmek ile anlamak aynı şey değildir.",
  "Araştırmalar, hız arttıkça anlamanın bir noktadan sonra düştüğünü gösteriyor. Bunun bir nedeni, normal okumada gözün geri dönebilmesidir. RSVP'de geri dönüş yoktur; kaçırdığın kelime gitmiştir. Bu yüzden durdurunca paragrafı gösteren özellik bir süs değil, bir ihtiyaçtır.",
  "Roman, deneme ya da haber gibi akan metinler için yüksek hızlar iyi çalışır. Ders kitabı, formül ya da yoğun kavramlar içeren metinlerde hızı düşürmek, gerekirse sık sık durmak daha verimlidir. XIX. yüzyıl romanlarını 500 ile okuyabilirsin; bir istatistik kitabını belki 250 ile.",
  "Son bir öneri: gözlerin yorulduğunu hissettiğinde dur. RSVP göz hareketini azaltır ama dikkat yine de bir kastır. On beş, yirmi dakikalık oturumlar ve arada kısa molalar, uzun ve yorucu bir oturumdan daha çok şey bırakır.",
  "Şimdi kendi kitabını ekleme zamanı. Kitaplığa dön ve bir EPUB seç. İyi okumalar!",
 ]),
]
DIPNOT = "Normal okumada göz sabitlemelerinin yaklaşık onda biri ile beşte biri arası geriye dönüktür."

def xhtml(baslik, paragraflar, dipnot=False):
    govde = "".join(f"<p>{p}</p>" for p in paragraflar)
    ek = f"<aside epub:type='footnote' id='dn1'><p>1. {DIPNOT}</p></aside>" if dipnot else ""
    return ("<?xml version='1.0' encoding='utf-8'?><!DOCTYPE html><html xmlns='http://www.w3.org/1999/xhtml' "
            "xmlns:epub='http://www.idpf.org/2007/ops' lang='tr'><head><title>" + baslik + "</title></head>"
            f"<body><section epub:type='chapter'><h1>{baslik}</h1>{govde}{ek}</section></body></html>")

def uret(hedef):
    with zipfile.ZipFile(hedef, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        z.writestr("META-INF/container.xml", "<?xml version='1.0'?><container version='1.0' xmlns='urn:oasis:names:tc:opendocument:xmlns:container'><rootfiles><rootfile full-path='OEBPS/paket.opf' media-type='application/oebps-package+xml'/></rootfiles></container>")
        ogeler = "".join(f"<item id='b{i}' href='b{i}.xhtml' media-type='application/xhtml+xml'/>" for i in range(len(BOLUMLER)))
        sira = "".join(f"<itemref idref='b{i}'/>" for i in range(len(BOLUMLER)))
        z.writestr("OEBPS/paket.opf", "<?xml version='1.0'?><package xmlns='http://www.idpf.org/2007/opf' version='3.0' unique-identifier='k'>"
            "<metadata xmlns:dc='http://purl.org/dc/elements/1.1/'><dc:identifier id='k'>hizli-okuma-ornek</dc:identifier>"
            "<dc:title>Gözün Durduğu Yer</dc:title><dc:creator>Hızlı Okuma</dc:creator><dc:language>tr</dc:language></metadata>"
            f"<manifest><item id='nav' href='nav.xhtml' media-type='application/xhtml+xml' properties='nav'/>{ogeler}</manifest>"
            f"<spine>{sira}</spine></package>")
        li = "".join(f"<li><a href='b{i}.xhtml'>{b}</a></li>" for i, (b, _) in enumerate(BOLUMLER))
        z.writestr("OEBPS/nav.xhtml", "<?xml version='1.0'?><html xmlns='http://www.w3.org/1999/xhtml' xmlns:epub='http://www.idpf.org/2007/ops'>"
            f"<head><title>İçindekiler</title></head><body><nav epub:type='toc'><ol>{li}</ol></nav></body></html>")
        for i, (b, ps) in enumerate(BOLUMLER):
            z.writestr(f"OEBPS/b{i}.xhtml", xhtml(b, ps, dipnot=(i == 0)))

if __name__ == "__main__":
    hedef = pathlib.Path(__file__).resolve().parent.parent / "ornek.epub"
    uret(hedef)
    print(hedef, hedef.stat().st_size, "bayt")
