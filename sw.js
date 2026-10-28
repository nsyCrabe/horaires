const CACHE = 'horaires-v14';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'shared').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Réception d'une image partagée depuis la galerie / un mail
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const data = await req.formData();
        const files = data.getAll('image');
        const cache = await caches.open('shared');
        let i = 0;
        for (const f of files) {
          await cache.put(new URL('./shared/' + Date.now() + '-' + (i++), self.registration.scope).href,
            new Response(f, { headers: { 'Content-Type': f.type || 'image/png', 'X-Modified': String(f.lastModified || Date.now()) } }));
        }
      } catch (err) {}
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }

  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // Réseau d'abord (mises à jour faciles), cache en secours (hors-ligne)
  e.respondWith(
    fetch(req.url, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});

