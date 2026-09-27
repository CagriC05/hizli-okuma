// EPUB okuma: zip'i tarayıcının kendi açıcısıyla aç (bağımlılık yok), OPF'den okuma sırasını,
// içindekilerden bölüm başlarını, XHTML'lerden paragraf metnini çıkar.

// ---- Zip ----

async function zipAc(dosya) {
  const tampon = new Uint8Array(await dosya.arrayBuffer());
  const g = new DataView(tampon.buffer);
  // Merkez dizin sonu kaydı (0x06054b50) dosyanın son ~64 KB'ında, sondan geriye aranır.
  let son = -1;
  for (let i = tampon.length - 22; i >= Math.max(0, tampon.length - 65557); i--) {
    if (g.getUint32(i, true) === 0x06054b50) { son = i; break; }
  }
  if (son < 0) throw new Error('Bu dosya bir EPUB (zip) değil.');
  const adet = g.getUint16(son + 10, true);
  let p = g.getUint32(son + 16, true);
  const utf8 = new TextDecoder();
  const girdiler = new Map();
  for (let n = 0; n < adet; n++) {
    if (g.getUint32(p, true) !== 0x02014b50) throw new Error('Zip dizini bozuk.');
    const yontem = g.getUint16(p + 10, true);
    const boyut = g.getUint32(p + 20, true);
    const adUz = g.getUint16(p + 28, true);
    const ekUz = g.getUint16(p + 30, true);
    const notUz = g.getUint16(p + 32, true);
    const yerel = g.getUint32(p + 42, true);
    const ad = utf8.decode(tampon.subarray(p + 46, p + 46 + adUz));
    girdiler.set(ad, { yontem, boyut, yerel });
    p += 46 + adUz + ekUz + notUz;
  }

  async function oku(ad) {
    const e = girdiler.get(ad);
    if (!e) return null;
    // Yerel başlıktaki ad/ek uzunlukları merkez dizindekinden farklı olabilir; buradan okunur.
    const bas = e.yerel + 30 + g.getUint16(e.yerel + 26, true) + g.getUint16(e.yerel + 28, true);
    const veri = tampon.subarray(bas, bas + e.boyut);
    if (e.yontem === 0) return utf8.decode(veri);
    if (e.yontem !== 8) throw new Error('Desteklenmeyen sıkıştırma: ' + e.yontem);
    const akis = new Blob([veri]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(akis).text();
  }

  return { oku, var: (ad) => girdiler.has(ad) };
}

// ---- Yollar ----

function klasor(yol) { const i = yol.lastIndexOf('/'); return i < 0 ? '' : yol.slice(0, i + 1); }

function coz(taban, href) {
  const parcalar = (klasor(taban) + decodeURIComponent(href.split('#')[0])).split('/');
  const sonuc = [];
  for (const s of parcalar) {
    if (s === '..') sonuc.pop();
    else if (s !== '.' && s !== '') sonuc.push(s);
  }
  return sonuc.join('/');
}

function xmlAyristir(metin, tur = 'application/xml') {
  const d = new DOMParser().parseFromString(metin, tur);
  if (d.getElementsByTagName('parsererror').length && tur !== 'text/html') {
    return new DOMParser().parseFromString(metin, 'text/html');
  }
  return d;
}

// Ad alanından bağımsız eleman arama (dc:title, opf:item, …).
function etiketler(kok, ad) {
  return [...kok.getElementsByTagName('*')].filter((e) => e.localName === ad);
}

// ---- Metin çıkarma ----

const BLOK = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre',
  'dt', 'dd', 'figcaption', 'td', 'th', 'div', 'section', 'article', 'header', 'footer']);
const BASLIK = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const AT = new Set(['script', 'style', 'rt', 'rp', 'svg', 'math', 'head', 'title', 'nav']);

function epubTuru(e) { return (e.getAttribute('epub:type') || e.getAttribute('role') || '').toLowerCase(); }

function dipnotMu(e) {
  const t = epubTuru(e);
  if (/footnote|endnote|rearnote|noteref|doc-noteref|doc-footnote|doc-endnote/.test(t)) return true;
  // Basılı kitabın sayfa sonu işareti; içinde genelde yalnız sayfa numarası olur.
  if (/pagebreak|doc-pagebreak/.test(t)) return true;
  // Dipnot bağlantısı çoğu kitapta <sup><a href="#n1">1</a></sup> biçiminde gelir.
  if (e.localName === 'sup' && e.querySelector('a')) return true;
  if (e.localName === 'a' && e.parentElement?.localName === 'sup') return true;
  return false;
}

// Dönüştürülmüş kitaplarda tek başına kalan sayfa numaraları: "47", "- 47 -", "[47]", "xii".
function sayfaNoMu(t) {
  const c = t.replace(/[\s\-–—[\](){}.|]/g, '');
  return /^\d{1,4}$/.test(c) || /^(?=[ivxlc])c{0,3}(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i.test(c);
}

function temizle(s) {
  return s.replace(/­/g, '').replace(/[\s  -​]+/g, ' ').trim();
}

// Bir belgedeki blokları sırasıyla gezip [{t, b}] (b: başlık mı) üretir.
// İçinde başka blok olan bloklar kendi doğrudan metnini, olmayanlar tüm metnini verir.
function paragraflar(belge) {
  const govde = belge.body || belge.getElementsByTagName('body')[0] || belge.documentElement;
  const cikti = [];
  let tampon = '';
  let tamponBaslik = false;

  function bosalt() {
    const t = temizle(tampon);
    if (!tamponBaslik && sayfaNoMu(t)) { tampon = ''; return; }
    if (t) cikti.push(tamponBaslik ? { t, b: 1 } : { t });
    tampon = '';
    tamponBaslik = false;
  }

  function gez(dugum, baslikIci) {
    for (const c of dugum.childNodes) {
      if (c.nodeType === 3) { tampon += c.nodeValue; continue; }
      if (c.nodeType !== 1) continue;
      const ad = c.localName.toLowerCase();
      if (AT.has(ad) || dipnotMu(c)) continue;
      if (ad === 'br') { tampon += ' '; continue; }
      if (ad === 'img') { const alt = c.getAttribute('alt'); if (alt && alt.length > 3) tampon += ' ' + alt + ' '; continue; }
      if (BLOK.has(ad)) {
        bosalt();
        const baslik = baslikIci || BASLIK.has(ad);
        gez(c, baslik);
        if (baslik) tamponBaslik = true;
        bosalt();
      } else {
        gez(c, baslikIci);
      }
    }
  }

  gez(govde, false);
  bosalt();
  return cikti;
}

// ---- İçindekiler ----

async function icindekiler(zip, opfYol, belge, manifest) {
  const cikti = [];
  // EPUB 3: properties="nav" olan belge
  const nav = [...manifest.values()].find((m) => (m.props || '').split(/\s+/).includes('nav'));
  if (nav) {
    const metin = await zip.oku(nav.yol);
    if (metin) {
      const d = xmlAyristir(metin, 'application/xhtml+xml');
      const navlar = etiketler(d, 'nav');
      const toc = navlar.find((n) => epubTuru(n).includes('toc')) || navlar[0];
      if (toc) {
        for (const a of etiketler(toc, 'a')) {
          const href = a.getAttribute('href');
          const ad = temizle(a.textContent);
          if (href && ad) cikti.push({ ad, yol: coz(nav.yol, href) });
        }
      }
    }
  }
  if (cikti.length) return cikti;
  // EPUB 2: NCX
  const spine = etiketler(belge, 'spine')[0];
  const ncxId = spine?.getAttribute('toc');
  const ncx = (ncxId && manifest.get(ncxId)) || [...manifest.values()].find((m) => m.tur === 'application/x-dtbncx+xml');
  if (ncx) {
    const metin = await zip.oku(ncx.yol);
    if (metin) {
      const d = xmlAyristir(metin);
      for (const np of etiketler(d, 'navPoint')) {
        const et = etiketler(np, 'text')[0];
        const ic = etiketler(np, 'content')[0];
        const ad = temizle(et?.textContent || '');
        const src = ic?.getAttribute('src');
        if (src && ad) cikti.push({ ad, yol: coz(ncx.yol, src) });
      }
    }
  }
  return cikti;
}

// ---- Ana giriş ----

// Dönüş: { baslik, yazar, paragraflar: [{t, b?}], bolumler: [{ad, p}] }
// bolumler[i].p: bölümün ilk paragrafının sırası.
export async function epubOku(dosya) {
  const zip = await zipAc(dosya);
  const kap = await zip.oku('META-INF/container.xml');
  if (!kap) throw new Error('EPUB içinde META-INF/container.xml yok.');
  const rootfile = etiketler(xmlAyristir(kap), 'rootfile')[0];
  const opfYol = rootfile?.getAttribute('full-path');
  const opfMetin = opfYol && await zip.oku(opfYol);
  if (!opfMetin) throw new Error('EPUB paket dosyası (OPF) bulunamadı.');
  const opf = xmlAyristir(opfMetin);

  const baslik = temizle(etiketler(opf, 'title')[0]?.textContent || '') || dosya.name.replace(/\.epub$/i, '');
  const yazar = etiketler(opf, 'creator').map((e) => temizle(e.textContent)).filter(Boolean).join(', ');

  const manifest = new Map();
  for (const it of etiketler(opf, 'item')) {
    manifest.set(it.getAttribute('id'), {
      yol: coz(opfYol, it.getAttribute('href') || ''),
      tur: it.getAttribute('media-type') || '',
      props: it.getAttribute('properties') || '',
    });
  }
  const sira = etiketler(opf, 'itemref')
    .filter((r) => r.getAttribute('linear') !== 'no')
    .map((r) => manifest.get(r.getAttribute('idref')))
    .filter((m) => m && /html|xml/.test(m.tur));
  if (!sira.length) throw new Error('Kitapta okunacak metin bulunamadı.');

  const tumParagraflar = [];
  const dosyaBasi = new Map(); // belge yolu → ilk paragraf sırası
  const dosyaIlkBaslik = [];
  for (const m of sira) {
    const metin = await zip.oku(m.yol);
    if (!metin) continue;
    const ps = paragraflar(xmlAyristir(metin, 'application/xhtml+xml'));
    if (!ps.length) continue;
    dosyaBasi.set(m.yol, tumParagraflar.length);
    dosyaIlkBaslik.push({ p: tumParagraflar.length, ad: ps.find((x) => x.b)?.t });
    tumParagraflar.push(...ps);
  }
  if (!tumParagraflar.length) throw new Error('Kitapta okunacak metin bulunamadı.');

  // Bölümler: içindekilerdeki her girdi, işaret ettiği belgenin başına eşlenir.
  // (Belge içi #çapa ayrımı yok sayılır: aynı belgeye düşen girdilerden ilki kalır.)
  let bolumler = [];
  const gorulen = new Set();
  for (const g of await icindekiler(zip, opfYol, opf, manifest)) {
    const p = dosyaBasi.get(g.yol);
    if (p === undefined || gorulen.has(p)) continue;
    gorulen.add(p);
    bolumler.push({ ad: g.ad, p });
  }
  bolumler.sort((a, b) => a.p - b.p);
  if (!bolumler.length) {
    bolumler = dosyaIlkBaslik.map((d, i) => ({ ad: d.ad || `Bölüm ${i + 1}`, p: d.p }));
  }
  if (bolumler[0].p !== 0) bolumler.unshift({ ad: 'Başlangıç', p: 0 });

  return { baslik, yazar, paragraflar: tumParagraflar, bolumler };
}
