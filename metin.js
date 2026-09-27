// Metin motoru: paragrafları kelimelere böler, her kelimeye göreli süre, odak harfi (ORP),
// cümle ve paragraf sınırı atar. Konum her yerde "kelime sırası" (tamsayı) ile tutulur.

const CUMLE_SONU = /[.!?…]["'”’»)\]]*$/;
const ARA_NOKTALAMA = /[,;:—–]["'”’»)\]]*$/;

// Ayarlardan gelen katsayılarla bir kelimenin göreli süresi (1 = ortalama kelime).
export function goreliSure(k, ayar) {
  const saf = k.replace(/[^\p{L}\p{N}]/gu, '');
  const n = saf.length;
  let f = 1;
  if (ayar.uzunYavas) {
    if (n <= 3) f = 0.85;
    else if (n > 7) f += Math.min(0.6, (n - 7) * 0.07);
  }
  if (/\d/.test(saf)) f += 0.3;
  const d = ayar.duraklama; // 0: kapalı, 1: az, 2: orta, 3: çok
  if (CUMLE_SONU.test(k)) f += 0.6 * d;
  else if (ARA_NOKTALAMA.test(k)) f += 0.25 * d;
  return f;
}

// Spritz tablosu: uzunluğa göre odak harfinin sırası. Baştaki tırnak/parantez atlanır.
export function odakSirasi(k) {
  const bas = k.match(/^[^\p{L}\p{N}]*/u)[0].length;
  const govde = k.slice(bas).replace(/[^\p{L}\p{N}]+$/u, '');
  const n = [...govde].length;
  const i = n <= 1 ? 0 : n <= 5 ? 1 : n <= 9 ? 2 : n <= 13 ? 3 : 4;
  return bas + i;
}

// Kitabı okunabilir yapıya çevirir. Kitap başına bir kez, açılışta çalışır.
export function hazirla(kitap, ayar) {
  const kelimeler = [];
  const parIlk = []; // paragraf → ilk kelime sırası
  const kelPar = [];
  for (let p = 0; p < kitap.paragraflar.length; p++) {
    parIlk.push(kelimeler.length);
    // Tireyle bitişik yazılmış uzun ifadeleri ("—ve") ayır; boşluğa göre böl.
    const parca = kitap.paragraflar[p].t.replace(/([—–])(?=\S)/g, '$1 ').split(' ');
    for (const k of parca) if (k) { kelimeler.push(k); kelPar.push(p); }
  }
  parIlk.push(kelimeler.length);
  const N = kelimeler.length;

  const cumleBasi = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    cumleBasi[i] = i === 0 || kelPar[i] !== kelPar[i - 1] || CUMLE_SONU.test(kelimeler[i - 1]) ? 1 : 0;
  }

  const m = { kelimeler, kelPar: Int32Array.from(kelPar), parIlk: Int32Array.from(parIlk), cumleBasi, N };
  sureleriHesapla(m, kitap, ayar);

  // Bölüm → ilk kelime; kelime → bölüm için sıralı dizi.
  m.bolumler = kitap.bolumler.map((b) => ({ ad: b.ad, k: parIlk[Math.min(b.p, parIlk.length - 1)] }));
  return m;
}

// Ayarlar değişince yalnız süreler yeniden hesaplanır.
// Ortalama göreli süre 1'e normalize edilir: 500 kel/dk seçildiyse kitap gerçekten ~500 ile akar.
export function sureleriHesapla(m, kitap, ayar) {
  const s = new Float32Array(m.N);
  let top = 0;
  for (let i = 0; i < m.N; i++) {
    let f = goreliSure(m.kelimeler[i], ayar);
    const p = m.kelPar[i];
    const parSonu = i === m.N - 1 || m.kelPar[i + 1] !== p;
    if (parSonu) f += 0.5 * ayar.duraklama + (kitap.paragraflar[p].b ? 1 : 0);
    s[i] = f;
    top += f;
  }
  const ort = top / Math.max(1, m.N);
  for (let i = 0; i < m.N; i++) s[i] /= ort;
  m.sure = s;
  // Kalan süre hesabı için sondan birikimli toplam.
  const kalan = new Float64Array(m.N + 1);
  for (let i = m.N - 1; i >= 0; i--) kalan[i] = kalan[i + 1] + s[i];
  m.kalan = kalan;
}

export function bolumBul(m, k) {
  let lo = 0, hi = m.bolumler.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (m.bolumler[mid].k <= k) lo = mid; else hi = mid - 1;
  }
  return lo;
}

export function cumleBasina(m, k) {
  while (k > 0 && !m.cumleBasi[k]) k--;
  return k;
}

export function oncekiCumle(m, k) {
  const bas = cumleBasina(m, k);
  // Cümlenin ortasındaysak önce kendi başına dön; zaten baştaysak bir öncekine.
  if (bas < k) return bas;
  return bas > 0 ? cumleBasina(m, bas - 1) : 0;
}

export function sonrakiCumle(m, k) {
  let i = k + 1;
  while (i < m.N && !m.cumleBasi[i]) i++;
  return Math.min(i, m.N - 1);
}

export function oncekiParagraf(m, k) {
  const p = m.kelPar[k];
  if (m.parIlk[p] < k) return m.parIlk[p];
  return m.parIlk[Math.max(0, p - 1)];
}

export function sonrakiParagraf(m, k) {
  const p = m.kelPar[k];
  return Math.min(m.parIlk[p + 1], m.N - 1);
}

// k'dan bitiş sırasına kadar kalan süre (ms), verilen hızda.
export function kalanMs(m, k, bitis, wpm) {
  return (m.kalan[k] - m.kalan[bitis]) * (60000 / wpm);
}
