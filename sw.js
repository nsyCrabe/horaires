const CACHE = 'horaires-v5';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {})))));
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

  // Réseau d'abord, mais pas plus de 2,5 s : sur une mauvaise connexion on ouvre le cache tout de suite
  e.respondWith((async () => {
    const net = fetch(req.url, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    });
    const quick = await Promise.race([net.catch(() => null), new Promise(r => setTimeout(() => r(null), 2500))]);
    if (quick) return quick;
    const hit = (await caches.match(req, { ignoreSearch: true })) || (await caches.match('./index.html'));
    return hit || net;
  })());
});
