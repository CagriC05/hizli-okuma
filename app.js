// Yönlendirme, kitaplık, RSVP okuyucu, paragraf paneli, bölüm listesi ve ayarlar.
import { epubOku } from './epub.js';
import {
  hazirla, sureleriHesapla, odakSirasi, bolumBul, cumleBasina,
  oncekiCumle, sonrakiCumle, oncekiParagraf, sonrakiParagraf, kalanMs,
} from './metin.js';
import {
  kitapKaydet, kitapGetir, kitapSil, kitapOzetleri, konum, konumKaydet, konumSil,
  ayarlar, ayarKaydet, istatistikEkle, istatistik,
} from './depo.js';

const $ = (s, k = document) => k.querySelector(s);
const kok = $('#uygulama');
const kutu = $('#kutu');
const HIZ_MIN = 100, HIZ_MAX = 1000, HIZ_ADIM = 25;
const BOY_MIN = 24, BOY_MAX = 72, BOY_ADIM = 4;

let ayar = ayarlar();

// ---- Yardımcılar ----

function kacis(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const sayi = (n) => Math.round(n).toLocaleString('tr-TR');

function sureYaz(ms) {
  const dk = Math.round(ms / 60000);
  if (dk < 1) return '<1 dk';
  if (dk < 60) return `${dk} dk`;
  const sa = Math.floor(dk / 60), kalan = dk % 60;
  return kalan ? `${sa} sa ${kalan} dk` : `${sa} sa`;
}

let bildirimZaman = 0;
function bildir(metin, sure = 2600) {
  let b = $('#bildirim');
  if (!b) { b = document.createElement('div'); b.id = 'bildirim'; document.body.append(b); }
  b.textContent = metin;
  b.classList.add('gorunur');
  clearTimeout(bildirimZaman);
  bildirimZaman = setTimeout(() => b.classList.remove('gorunur'), sure);
}

function kutuAc(html, hazirla) {
  kutu.innerHTML = html;
  kutu.onclick = (e) => { if (e.target === kutu || e.target.closest('[data-kapat]')) kutu.close(); };
  hazirla?.(kutu);
  kutu.showModal();
}

function onayla(soru, evet = 'Evet') {
  return new Promise((coz) => {
    kutuAc(`<div class="kutu-ic"><p>${kacis(soru)}</p>
      <div class="satir sag"><button class="dugme" data-kapat>Vazgeç</button>
      <button class="dugme tehlike" id="evet">${kacis(evet)}</button></div></div>`, (k) => {
      $('#evet', k).onclick = () => { coz(true); kutu.close(); };
      kutu.addEventListener('close', () => coz(false), { once: true });
    });
  });
}

// ---- Yönlendirme ----

function git() {
  okuyucuKapat();
  if (kutu.open) kutu.close();
  const m = location.hash.match(/^#\/oku\/(.+)$/);
  if (m) okuyucuAc(decodeURIComponent(m[1]));
  else kitaplik();
}
window.addEventListener('hashchange', git);

// ---- İçe aktarma ----

function kimlik() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function iceAktar(dosyalar) {
  let son = null;
  for (const d of dosyalar) {
    bildir(`“${d.name}” açılıyor…`, 60000);
    try {
      const k = await epubOku(d);
      const kelimeSayisi = k.paragraflar.reduce((t, p) => t + p.t.split(' ').length, 0);
      son = { id: kimlik(), ...k, kelimeSayisi, eklendi: Date.now() };
      await kitapKaydet(son);
      bildir(`“${k.baslik}” eklendi · ${sayi(kelimeSayisi)} kelime`);
    } catch (e) {
      console.error(e);
      bildir(`“${d.name}” açılamadı: ${e.message}`, 5000);
    }
  }
  // Tarayıcı yer darlığında site verisini silmesin diye kalıcı depolama istenir.
  navigator.storage?.persist?.().catch(() => {});
  return son;
}

// Android'de dosya yöneticisinden "Paylaş → Hızlı Okuma": sw.js dosyayı önbelleğe bırakır.
async function paylasilaniAl() {
  if (!new URLSearchParams(location.search).has('paylasim') || !('caches' in window)) return;
  history.replaceState(null, '', location.pathname + location.hash);
  const c = await caches.open('hizli-okuma-paylasim');
  const yanit = await c.match('paylasilan');
  if (!yanit) return;
  const ad = decodeURIComponent(yanit.headers.get('X-Dosya-Adi') || 'kitap.epub');
  const dosya = new File([await yanit.blob()], ad);
  await c.delete('paylasilan');
  const k = await iceAktar([dosya]);
  if (k) location.hash = '#/oku/' + encodeURIComponent(k.id);
}

// ---- Kitaplık ----

// İlk açılışta kendini anlatan örnek kitap eklenir; silinirse bir daha kendiliğinden gelmez.
const ORNEK = 'hizli-okuma-ornek-eklendi';

async function ornekEkle() {
  const y = await fetch('ornek.epub');
  if (!y.ok) throw new Error('Örnek kitap indirilemedi.');
  const k = await iceAktar([new File([await y.blob()], 'ornek.epub')]);
  try { localStorage.setItem(ORNEK, '1'); } catch {}
  return k;
}

async function kitaplik() {
  document.body.className = '';
  let ozet = await kitapOzetleri().catch(() => []);
  let ilkKez = false;
  try { ilkKez = !ozet.length && !localStorage.getItem(ORNEK); } catch {}
  if (ilkKez) {
    await ornekEkle().catch(() => {});
    ozet = await kitapOzetleri().catch(() => []);
  }
  const ist = istatistik();
  const ortHiz = ist.toplam.ms > 0 ? ist.toplam.kelime / (ist.toplam.ms / 60000) : 0;
  kok.innerHTML = `
    <header class="ustbar"><h1>Hızlı Okuma</h1>
      <button class="simge" id="ayarAc" aria-label="Ayarlar">Aa</button></header>
    <div class="istat">
      <div><strong>${sayi(ist.bugun.kelime)}</strong><span>bugün kelime</span></div>
      <div><strong>${sureYaz(ist.bugun.ms)}</strong><span>bugün</span></div>
      <div><strong>${ist.seri}</strong><span>gün seri</span></div>
      <div><strong>${ortHiz ? sayi(ortHiz) : '—'}</strong><span>ort. kel/dk</span></div>
    </div>
    <label class="dugme ana genis">＋ EPUB ekle
      <input type="file" id="dosya" accept=".epub,application/epub+zip" multiple hidden></label>
    <div id="liste">${ozet.length ? ozet.map(kitapKarti).join('') : `
      <div class="bos"><p><strong>Kitaplık boş.</strong></p>
      <p class="soluk">Bir EPUB ekle; kelimeler ekranın ortasında tek tek akar, göz satır boyunca gezmez.
      Durdurunca bulunduğun paragraf açılır, istediğin kelimeye dokunup oradan devam edersin.</p>
      <button class="dugme" id="ornekEkle">Örnek kitabı ekle</button></div>`}
    </div>`;

  $('#dosya').onchange = async (e) => {
    const k = await iceAktar([...e.target.files]);
    e.target.value = '';
    if (k) kitaplik();
  };
  $('#ayarAc').onclick = () => ayarKutusu();
  const ornekDugme = $('#ornekEkle');
  if (ornekDugme) ornekDugme.onclick = () => ornekEkle().then(kitaplik, (e) => bildir(e.message));
  $('#liste').onclick = async (e) => {
    const kart = e.target.closest('[data-id]');
    if (!kart) return;
    const id = kart.dataset.id;
    if (e.target.closest('.sil')) {
      const o = ozet.find((x) => x.id === id);
      if (await onayla(`“${o.baslik}” kitaplıktan silinsin mi? Okuma konumu da silinir.`, 'Sil')) {
        await kitapSil(id);
        konumSil(id);
        kitaplik();
      }
      return;
    }
    location.hash = '#/oku/' + encodeURIComponent(id);
  };
}

function kitapKarti(o) {
  const k = konum(o.id).k;
  const oran = o.kelimeSayisi ? Math.min(1, k / o.kelimeSayisi) : 0;
  const kalan = (o.kelimeSayisi - k) / ayar.wpm * 60000;
  return `<div class="kart tiklanir kitap" data-id="${kacis(o.id)}">
    <div class="kart-baslik"><div class="kitap-ad"><strong>${kacis(o.baslik)}</strong>
      ${o.yazar ? `<span class="soluk">${kacis(o.yazar)}</span>` : ''}</div>
      <button class="simge sil" aria-label="Sil">✕</button></div>
    <div class="cubuk"><i style="width:${(oran * 100).toFixed(1)}%"></i></div>
    <div class="soluk kucuk">%${Math.floor(oran * 100)} · ${sayi(o.kelimeSayisi)} kelime ·
      ${oran >= 1 ? 'bitti' : `kalan ${kalan < 60000 ? '' : '~'}${sureYaz(kalan)} (${ayar.wpm} kel/dk)`}</div>
  </div>`;
}

// ---- Okuyucu ----

// Açık okuyucunun durumu; kapalıyken null.
let O = null;

async function okuyucuAc(id) {
  const kitap = await kitapGetir(id).catch(() => null);
  if (!kitap) { bildir('Kitap bulunamadı.'); location.hash = '#/'; return; }
  const m = hazirla(kitap, ayar);
  O = {
    kitap, m, k: Math.min(konum(id).k, m.N - 1),
    oynuyor: false, zamanlayici: 0, hedef: 0, rampa: 0,
    atlandi: false,     // kullanıcı bilerek bir kelimeye atladıysa cümle başına dönülmez
    oturum: { kelime: 0, ms: 0 }, sonKayit: 0, kilit: null,
  };
  document.body.className = 'okuma';
  kok.innerHTML = `
    <div class="okuyucu">
      <header class="oku-ust">
        <a class="simge" href="#/" aria-label="Kitaplık">‹</a>
        <div class="oku-bilgi"><strong id="bolumAd"></strong><span class="soluk">${kacis(kitap.baslik)}</span></div>
        <button class="simge" id="bolumAc" aria-label="Bölümler">☰</button>
        <button class="simge" id="ayarAc" aria-label="Ayarlar">Aa</button>
      </header>
      <section class="sahne" id="sahne">
        <div class="rsvp" id="rsvp">
          <div class="kilavuz ust"></div><div class="kilavuz alt"></div>
          <div class="kelime" id="kelime"><span></span><span class="odak"></span><span></span></div>
          <div class="onizleme" id="onizleme"></div>
          <div class="ipucu" id="ipucu">dokun: başlat / durdur · kaydır: cümle</div>
        </div>
        <div class="panel" id="panel"></div>
      </section>
      <footer class="oku-alt">
        <input type="range" id="kaydir" min="0" max="${m.N - 1}" step="1" aria-label="Kitaptaki konum">
        <div class="ilerleme-bilgi"><span id="yuzde"></span><span id="kalan"></span></div>
        <div class="kontroller">
          <button class="kontrol" data-git="op" aria-label="Önceki paragraf">⇤</button>
          <button class="kontrol" data-git="oc" aria-label="Önceki cümle">‹</button>
          <button class="kontrol oynat" id="oynat" aria-label="Başlat">▶</button>
          <button class="kontrol" data-git="sc" aria-label="Sonraki cümle">›</button>
          <button class="kontrol" data-git="sp" aria-label="Sonraki paragraf">⇥</button>
        </div>
        <div class="hiz">
          <button class="simge boy kucuk-a" data-boy="-1" aria-label="Yazıyı küçült">A</button>
          <button class="simge boy buyuk-a" data-boy="1" aria-label="Yazıyı büyüt">A</button>
          <span class="ayrac"></span>
          <button class="simge" data-hiz="-1" aria-label="Yavaşla">−</button>
          <button class="hiz-deger" id="hizDeger"></button>
          <button class="simge" data-hiz="1" aria-label="Hızlan">＋</button>
        </div>
      </footer>
    </div>`;

  $('#oynat').onclick = () => (O.oynuyor ? durdur() : oynat());
  $('#bolumAc').onclick = () => { durdur(); bolumKutusu(); };
  $('#ayarAc').onclick = () => { durdur(); ayarKutusu(); };
  $('#hizDeger').onclick = () => { durdur(); ayarKutusu(); };
  document.querySelectorAll('[data-git]').forEach((b) => { b.onclick = () => gezin(b.dataset.git); });
  document.querySelectorAll('[data-hiz]').forEach((b) => { b.onclick = () => hizDegis(+b.dataset.hiz * HIZ_ADIM); });
  document.querySelectorAll('[data-boy]').forEach((b) => { b.onclick = () => boyDegis(+b.dataset.boy * BOY_ADIM); });

  const kaydir = $('#kaydir');
  kaydir.oninput = () => { durdur(); O.k = +kaydir.value; O.atlandi = true; ciz(); };
  kaydir.onchange = () => konumKaydet(O.kitap.id, O.k);

  dokunmaBagla($('#rsvp'));
  $('#panel').onclick = (e) => {
    const s = e.target.closest('[data-k]');
    if (!s) return;
    const k = +s.dataset.k;
    // Zaten seçili kelimeye dokunmak "buradan devam" demek.
    if (k === O.k) { oynat(); return; }
    O.k = k; O.atlandi = true;
    ciz();
    konumKaydet(O.kitap.id, O.k);
  };

  ciz();
  if (!sessionStorage.getItem('hizli-okuma-ipucu')) {
    try { sessionStorage.setItem('hizli-okuma-ipucu', '1'); } catch {}
  } else $('#ipucu').remove();
}

function okuyucuKapat() {
  if (!O) return;
  durdur();
  konumKaydet(O.kitap.id, O.k);
  O = null;
}

// Sahne: dokun = başlat/durdur, yatay kaydır = cümle geri/ileri.
function dokunmaBagla(el) {
  let x0 = 0, y0 = 0, t0 = 0;
  el.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); });
  el.addEventListener('pointerup', (e) => {
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      gezin(dx < 0 ? 'sc' : 'oc');
    } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && Date.now() - t0 < 600) {
      O.oynuyor ? durdur() : oynat();
    }
  });
}

function gezin(yon) {
  const { m } = O;
  const f = { op: oncekiParagraf, oc: oncekiCumle, sc: sonrakiCumle, sp: sonrakiParagraf }[yon];
  O.k = f(m, O.k);
  O.atlandi = true;
  if (O.oynuyor) { O.hedef = performance.now(); O.rampa = 0; clearTimeout(O.zamanlayici); tik(); }
  else ciz();
}

function hizDegis(d) {
  ayar.wpm = Math.max(HIZ_MIN, Math.min(HIZ_MAX, ayar.wpm + d));
  ayarKaydet(ayar);
  if (O) bilgiCiz();
}

function boyDegis(d) {
  ayar.yaziBoyu = Math.max(BOY_MIN, Math.min(BOY_MAX, ayar.yaziBoyu + d));
  ayarKaydet(ayar);
  kelimeCiz();
  bildir(`Yazı boyu ${ayar.yaziBoyu} px`, 1200);
}

// ---- Oynatma döngüsü ----

function oynat() {
  if (!O || O.oynuyor) return;
  const { m } = O;
  if (O.k >= m.N - 1 && O.bitti) O.k = 0;
  O.bitti = false;
  if (ayar.cumleBasi && !O.atlandi) O.k = cumleBasina(m, O.k);
  O.atlandi = false;
  O.oynuyor = true;
  O.rampa = 0;
  O.hedef = performance.now();
  document.body.classList.add('akiyor');
  $('#oynat').textContent = '❚❚';
  $('#oynat').setAttribute('aria-label', 'Durdur');
  $('#ipucu')?.remove();
  uyanikTut(true);
  tik();
}

function tik() {
  const { m } = O;
  kelimeCiz();
  let d = m.sure[O.k] * 60000 / ayar.wpm;
  if (ayar.yumusak && O.rampa < 6) { d *= 1 + (6 - O.rampa) * 0.12; O.rampa++; }
  O.hedef += d;
  O.oturum.ms += d;
  O.zamanlayici = setTimeout(() => {
    if (!O?.oynuyor) return;
    if (O.k >= m.N - 1) { O.bitti = true; durdur(); return; }
    O.k++;
    O.oturum.kelime++;
    // Konum, sayfa kapansa bile kaybolmasın diye birkaç saniyede bir kaydedilir.
    if (O.hedef - O.sonKayit > 5000) { O.sonKayit = O.hedef; konumKaydet(O.kitap.id, O.k); }
    tik();
  }, Math.max(0, O.hedef - performance.now()));
  // Ağır işler (kaydırıcı, kalan süre) her kelimede değil, seyrek güncellenir.
  if (O.k % 8 === 0) bilgiCiz();
}

function durdur() {
  if (!O || !O.oynuyor) return;
  clearTimeout(O.zamanlayici);
  O.oynuyor = false;
  document.body.classList.remove('akiyor');
  $('#oynat').textContent = '▶';
  $('#oynat').setAttribute('aria-label', 'Başlat');
  uyanikTut(false);
  istatistikEkle(O.oturum.kelime, O.oturum.ms);
  O.sonOturum = O.oturum;
  O.oturum = { kelime: 0, ms: 0 };
  konumKaydet(O.kitap.id, O.k);
  ciz();
}

async function uyanikTut(ac) {
  try {
    if (ac && 'wakeLock' in navigator) O.kilit = await navigator.wakeLock.request('screen');
    else if (!ac && O?.kilit) { await O.kilit.release(); O.kilit = null; }
  } catch {}
}

document.addEventListener('visibilitychange', () => { if (document.hidden) durdur(); });
window.addEventListener('pagehide', () => { if (O) { durdur(); konumKaydet(O.kitap.id, O.k); } });

// ---- Çizim ----

function ciz() {
  kelimeCiz();
  bilgiCiz();
  panelCiz();
}

function kelimeCiz() {
  const { m, k } = O;
  const w = m.kelimeler[k];
  const harf = [...w];
  const i = Math.min(odakSirasi(w), harf.length - 1);
  const el = $('#kelime');
  const [on, odak, son] = el.children;
  on.textContent = harf.slice(0, i).join('');
  odak.textContent = harf[i] || '';
  son.textContent = harf.slice(i + 1).join('');
  el.classList.toggle('baslik', !!O.kitap.paragraflar[m.kelPar[k]].b);
  el.classList.toggle('renksiz', !ayar.odakRenk);
  el.style.fontSize = ayar.yaziBoyu + 'px';
  el.parentElement.style.setProperty('--boy', ayar.yaziBoyu + 'px');
  // Odak harfinin ortası sahnenin tam ortasına oturur; taşan uzun kelime küçültülür.
  const G = el.parentElement.clientWidth;
  const merkez = odak.offsetLeft + odak.offsetWidth / 2;
  const s = Math.min(1, (G / 2 - 10) / Math.max(merkez, el.offsetWidth - merkez, 1));
  el.style.transform = `translate(${G / 2 - merkez * s}px, -50%) scale(${s})`;

  const oniz = $('#onizleme');
  oniz.textContent = ayar.onizleme ? m.kelimeler.slice(k + 1, k + 4).join(' ') : '';
}

function bilgiCiz() {
  const { m, k } = O;
  const b = bolumBul(m, k);
  const bolumSonu = b + 1 < m.bolumler.length ? m.bolumler[b + 1].k : m.N;
  $('#bolumAd').textContent = m.bolumler[b].ad;
  $('#kaydir').value = k;
  $('#yuzde').textContent = `%${(k / Math.max(1, m.N - 1) * 100).toFixed(1)}`;
  $('#kalan').textContent = `bölüm ${sureYaz(kalanMs(m, k, bolumSonu, ayar.wpm))} · kitap ${sureYaz(kalanMs(m, k, m.N, ayar.wpm))}`;
  $('#hizDeger').textContent = `${ayar.wpm} kel/dk`;
}

// Durunca: önceki, şimdiki ve sonraki paragraflar; her kelime dokunulabilir.
function panelCiz() {
  const panel = $('#panel');
  if (O.oynuyor) { panel.innerHTML = ''; return; }
  const { m, k, kitap } = O;
  const p = m.kelPar[k];
  const bas = Math.max(0, p - 2), bit = Math.min(kitap.paragraflar.length - 1, p + 2);
  let html = '';
  const so = O.sonOturum;
  if (so?.kelime > 20) {
    const hiz = so.kelime / (so.ms / 60000);
    html += `<div class="oturum">Bu oturum: ${sayi(so.kelime)} kelime · ${sureYaz(so.ms)} · ~${sayi(hiz)} kel/dk</div>`;
  }
  if (O.bitti) html += `<div class="oturum">Kitabın sonu. ▶ ile baştan başlar.</div>`;
  for (let q = bas; q <= bit; q++) {
    const sinif = q === p ? 'par simdiki' : 'par';
    const etiket = kitap.paragraflar[q].b ? 'h3' : 'p';
    let ic = '';
    for (let i = m.parIlk[q]; i < m.parIlk[q + 1]; i++) {
      const s = i === k ? ' class="simdi"' : i < k && q === p ? ' class="okundu"' : '';
      ic += `<span data-k="${i}"${s}>${kacis(m.kelimeler[i])}</span> `;
    }
    html += `<${etiket} class="${sinif}">${ic}</${etiket}>`;
  }
  html += `<div class="panel-ipucu soluk">Bir kelimeye dokun: oradan devam. Vurgulu kelimeye dokun: başlat.</div>`;
  panel.innerHTML = html;
  const simdi = $('.simdi', panel);
  if (simdi) panel.scrollTop = simdi.offsetTop - panel.clientHeight / 2 + simdi.offsetHeight;
}

window.addEventListener('resize', () => { if (O) kelimeCiz(); });

document.addEventListener('keydown', (e) => {
  if (!O || kutu.open || e.target.matches('input, textarea')) return;
  const tus = {
    ' ': () => (O.oynuyor ? durdur() : oynat()),
    ArrowLeft: () => gezin(e.shiftKey ? 'op' : 'oc'),
    ArrowRight: () => gezin(e.shiftKey ? 'sp' : 'sc'),
    ArrowUp: () => hizDegis(HIZ_ADIM),
    ArrowDown: () => hizDegis(-HIZ_ADIM),
    '+': () => boyDegis(BOY_ADIM),
    '=': () => boyDegis(BOY_ADIM),
    '-': () => boyDegis(-BOY_ADIM),
    Escape: () => { location.hash = '#/'; },
  }[e.key];
  if (tus) { e.preventDefault(); tus(); }
});

// ---- Kutular ----

function bolumKutusu() {
  const { m, k } = O;
  const simdiki = bolumBul(m, k);
  const satirlar = m.bolumler.map((b, i) => {
    const son = i + 1 < m.bolumler.length ? m.bolumler[i + 1].k : m.N;
    return `<button class="bolum${i === simdiki ? ' secili' : ''}${son <= k ? ' okundu' : ''}" data-i="${i}">
      <span>${kacis(b.ad)}</span><span class="soluk">${sureYaz(kalanMs(m, b.k, son, ayar.wpm))}</span></button>`;
  }).join('');
  kutuAc(`<div class="kutu-ic"><div class="kutu-ust"><strong>Bölümler</strong>
    <button class="simge" data-kapat aria-label="Kapat">✕</button></div>
    <div class="bolum-liste">${satirlar}</div></div>`, (kt) => {
    $('.bolum-liste', kt).onclick = (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      O.k = m.bolumler[+b.dataset.i].k;
      O.atlandi = true;
      kutu.close();
      ciz();
      konumKaydet(O.kitap.id, O.k);
    };
    requestAnimationFrame(() => $('.secili', kt)?.scrollIntoView({ block: 'center' }));
  });
}

function ayarKutusu() {
  const secim = (ad, deger, secenekler) => secenekler.map(([v, e]) =>
    `<label class="secim"><input type="radio" name="${ad}" value="${v}" ${deger === v ? 'checked' : ''}><span>${e}</span></label>`).join('');
  const anahtar = (ad, e, a) =>
    `<label class="anahtar"><span>${e}${a ? `<small class="soluk">${a}</small>` : ''}</span>
     <input type="checkbox" name="${ad}" ${ayar[ad] ? 'checked' : ''}></label>`;

  kutuAc(`<form class="kutu-ic ayarlar" id="ayarForm"><div class="kutu-ust"><strong>Ayarlar</strong>
    <button type="button" class="simge" data-kapat aria-label="Kapat">✕</button></div>
    <label class="alan"><span>Hız <b id="wpmY">${ayar.wpm}</b> kel/dk</span>
      <input type="range" name="wpm" min="${HIZ_MIN}" max="${HIZ_MAX}" step="${HIZ_ADIM}" value="${ayar.wpm}"></label>
    <label class="alan"><span>Yazı boyu <b id="boyY">${ayar.yaziBoyu}</b> px</span>
      <input type="range" name="yaziBoyu" min="${BOY_MIN}" max="${BOY_MAX}" step="2" value="${ayar.yaziBoyu}"></label>
    <div class="ornek" id="ornek" style="font-size:${ayar.yaziBoyu}px">oku<b class="${ayar.odakRenk ? '' : 'renksiz'}">m</b>a</div>
    <div class="alan"><span>Noktalamada duraklama</span>
      <div class="secimler">${secim('duraklama', ayar.duraklama, [[0, 'Yok'], [1, 'Az'], [2, 'Orta'], [3, 'Çok']])}</div></div>
    ${anahtar('odakRenk', 'Odak harfini renklendir')}
    ${anahtar('uzunYavas', 'Kelime uzunluğuna göre süre', 'Kelime harf sayısıyla orantılı kalır: 12 harfli kelime 5 harfliden ~1,5 kat uzun. Ortalama hız değişmez.')}
    ${anahtar('cumleBasi', 'Devam ederken cümle başından al', 'Durup başlatınca yarım kalan cümleyi baştan okursun.')}
    ${anahtar('yumusak', 'Yumuşak başlangıç', 'Başlatınca ilk birkaç kelime yavaş gelir, göz uyum sağlar.')}
    ${anahtar('onizleme', 'Sıradaki kelimeleri soluk göster')}
    <p class="soluk kucuk">Klavye: boşluk başlat/durdur · ←/→ cümle · Shift+←/→ paragraf · ↑/↓ hız · +/− yazı boyu</p>
  </form>`, (kt) => {
    const f = $('#ayarForm', kt);
    f.onsubmit = (e) => e.preventDefault();
    f.oninput = () => {
      const eski = { duraklama: ayar.duraklama, uzunYavas: ayar.uzunYavas };
      ayar = {
        ...ayar,
        wpm: +f.wpm.value,
        yaziBoyu: +f.yaziBoyu.value,
        duraklama: +f.querySelector('[name=duraklama]:checked').value,
        odakRenk: f.odakRenk.checked,
        uzunYavas: f.uzunYavas.checked,
        cumleBasi: f.cumleBasi.checked,
        yumusak: f.yumusak.checked,
        onizleme: f.onizleme.checked,
      };
      ayarKaydet(ayar);
      $('#wpmY', kt).textContent = ayar.wpm;
      $('#boyY', kt).textContent = ayar.yaziBoyu;
      $('#ornek', kt).style.fontSize = ayar.yaziBoyu + 'px';
      $('#ornek b', kt).className = ayar.odakRenk ? '' : 'renksiz';
      if (O && (eski.duraklama !== ayar.duraklama || eski.uzunYavas !== ayar.uzunYavas)) {
        sureleriHesapla(O.m, O.kitap, ayar);
      }
      if (O) { kelimeCiz(); bilgiCiz(); }
    };
    kutu.addEventListener('close', () => { if (!O) kitaplik(); }, { once: true });
  });
}

// ---- Başlangıç ----

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
paylasilaniAl().catch((e) => bildir('Paylaşılan dosya alınamadı: ' + e.message, 5000));
git();
