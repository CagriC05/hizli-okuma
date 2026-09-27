// Kalıcı veri. Kitap metinleri büyük olduğu için IndexedDB'de; konum, ayar ve istatistik
// küçük olduğu için localStorage'da (diğer uygulamalarla aynı düzen).

const VT_AD = 'hizli-okuma';
const KITAP = 'kitaplar';
let vtSoz = null;

function vt() {
  if (!vtSoz) {
    vtSoz = new Promise((coz, red) => {
      const r = indexedDB.open(VT_AD, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(KITAP, { keyPath: 'id' });
      r.onsuccess = () => coz(r.result);
      r.onerror = () => red(r.error);
    });
  }
  return vtSoz;
}

async function islem(tur, f) {
  const d = await vt();
  return new Promise((coz, red) => {
    const t = d.transaction(KITAP, tur);
    const r = f(t.objectStore(KITAP));
    t.oncomplete = () => coz(r?.result);
    t.onerror = () => red(t.error);
    t.onabort = () => red(t.error || new Error('İşlem iptal edildi.'));
  });
}

export const kitapKaydet = (k) => islem('readwrite', (s) => s.put(k));
export const kitapGetir = (id) => islem('readonly', (s) => s.get(id));
export const kitapSil = (id) => islem('readwrite', (s) => s.delete(id));

// Liste için metinsiz özet (paragraflar büyük; kitaplık ekranı onları istemiyor).
export async function kitapOzetleri() {
  const d = await vt();
  return new Promise((coz, red) => {
    const ozet = [];
    const r = d.transaction(KITAP).objectStore(KITAP).openCursor();
    r.onsuccess = () => {
      const c = r.result;
      if (!c) return coz(ozet.sort((a, b) => (konum(b.id).t || b.eklendi) - (konum(a.id).t || a.eklendi)));
      const { id, baslik, yazar, kelimeSayisi, eklendi } = c.value;
      ozet.push({ id, baslik, yazar, kelimeSayisi, eklendi });
      c.continue();
    };
    r.onerror = () => red(r.error);
  });
}

// ---- localStorage ----

function oku(anahtar, bos) {
  try { return JSON.parse(localStorage.getItem(anahtar) || 'null') ?? bos; } catch { return bos; }
}
function yaz(anahtar, v) {
  try { localStorage.setItem(anahtar, JSON.stringify(v)); } catch {}
}

const KONUM = 'hizli-okuma-konum-v1';
const AYAR = 'hizli-okuma-ayar-v1';
const ISTAT = 'hizli-okuma-istat-v1';

// { [kitapId]: { k: kelime sırası, t: son okuma zamanı } }
export function konum(id) { return oku(KONUM, {})[id] || { k: 0, t: 0 }; }
export function konumKaydet(id, k) {
  const h = oku(KONUM, {});
  h[id] = { k, t: Date.now() };
  yaz(KONUM, h);
}
export function konumSil(id) {
  const h = oku(KONUM, {});
  delete h[id];
  yaz(KONUM, h);
}

export const VARSAYILAN_AYAR = {
  wpm: 350,
  yaziBoyu: 40,       // px
  odakRenk: true,     // odak harfi vurgulu
  duraklama: 2,       // noktalama duraklaması: 0 yok … 3 çok
  uzunYavas: true,    // uzun kelimede yavaşla, kısa kelimede hızlan
  cumleBasi: true,    // durup devam edince cümle başından al
  yumusak: true,      // başlarken birkaç kelime yavaştan hızlan
  onizleme: false,    // odağın altında sıradaki kelimeleri soluk göster
};
export function ayarlar() { return { ...VARSAYILAN_AYAR, ...oku(AYAR, {}) }; }
export function ayarKaydet(a) { yaz(AYAR, a); }

// Günlük okuma: { 'YYYY-AA-GG': { kelime, ms } }
function bugun() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function istatistikEkle(kelime, ms) {
  if (kelime <= 0) return;
  const h = oku(ISTAT, {});
  const g = h[bugun()] || { kelime: 0, ms: 0 };
  g.kelime += kelime;
  g.ms += ms;
  h[bugun()] = g;
  yaz(ISTAT, h);
}
export function istatistik() {
  const h = oku(ISTAT, {});
  const gunler = Object.keys(h).sort();
  // Seri: bugünden (ya da dünden) geriye kesintisiz okunan günler.
  let seri = 0;
  const d = new Date();
  if (!h[bugun()]) d.setDate(d.getDate() - 1);
  for (;;) {
    const a = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!h[a]) break;
    seri++;
    d.setDate(d.getDate() - 1);
  }
  const toplam = gunler.reduce((t, g) => ({ kelime: t.kelime + h[g].kelime, ms: t.ms + h[g].ms }), { kelime: 0, ms: 0 });
  return { bugun: h[bugun()] || { kelime: 0, ms: 0 }, seri, toplam };
}
