// Çevrimdışı çalışma: uygulama kabuğunu önbelleğe al, ağ varsa tazele.
// Ayrıca Android "Paylaş" hedefi: gelen EPUB'ı önbelleğe bırakıp uygulamaya yönlendir.
const ON_EK = 'hizli-okuma-v';
const AD = 'hizli-okuma-v1';
const PAYLASIM = 'hizli-okuma-paylasim';
const DOSYALAR = [
  './', './index.html', './styles.css',
  './app.js', './epub.js', './metin.js', './depo.js',
  './manifest.json', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(AD).then((c) => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // Aynı origin altında başka uygulamalar da olabilir (…github.io/<depo>/).
  // Bu yüzden yalnızca BU uygulamanın ön ekini taşıyan eski sürümler silinir.
  e.waitUntil(caches.keys()
    .then((adlar) => Promise.all(
      adlar.filter((a) => a.startsWith(ON_EK) && a !== AD).map((a) => caches.delete(a))))
    .then(() => self.clients.claim()));
});

async function paylasimAl(istek) {
  const veri = await istek.formData();
  const dosya = veri.get('kitap');
  if (dosya && typeof dosya !== 'string') {
    const c = await caches.open(PAYLASIM);
    await c.put('paylasilan', new Response(dosya, {
      headers: { 'X-Dosya-Adi': encodeURIComponent(dosya.name || 'kitap.epub') },
    }));
  }
  return Response.redirect('./index.html?paylasim=1', 303);
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/paylas')) {
    e.respondWith(paylasimAl(e.request));
    return;
  }
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((yanit) => {
        const kopya = yanit.clone();
        caches.open(AD).then((c) => c.put(e.request, kopya)).catch(() => {});
        return yanit;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
