// Village's service worker: Pages you've opened keep working without a connection.
// Registered by src/components/ServiceWorker.tsx (production only). Kept small on purpose:
//   - Pages: always from the network first, so you never see an old version while online. The copy
//     is kept, and used only when the network fails. Never seen offline: /offline.
//   - Build files (/_next/static, named by their contents): kept once, used from then on.
//   - Pictures (/_next/image, icons): the kept copy at once, refreshed in the background.
//   - Everything else (the database, sign-in, /api) is left alone.
// Changing VERSION clears the old copies on the next visit.

const VERSION = 'v1';
const PAGES = `village-pages-${VERSION}`;
const BUILD = `village-build-${VERSION}`;
const PICTURES = `village-pictures-${VERSION}`;
const OFFLINE = '/offline';
const MAX_PAGES = 60;
const MAX_PICTURES = 300;

// The offline page is kept from the start, with the build files it needs to run (its list of
// saved pages is drawn in the browser), since it may be needed before you've ever seen it.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const pages = await caches.open(PAGES);
    await pages.addAll([OFFLINE, '/icons/icon-192.png']);
    try {
      const html = await (await pages.match(OFFLINE)).text();
      const files = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])];
      await (await caches.open(BUILD)).addAll(files);
    } catch { /* the page still shows, just without its list */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([PAGES, BUILD, PICTURES]);
    for (const key of await caches.keys()) if (key.startsWith('village-') && !keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

/** Drops the oldest copies once a store holds more than `max`. */
async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await c.delete(k);
}

const keepable = (res) => res && res.ok && res.type === 'basic' && !res.redirected;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.pathname === '/sw.js') return;

  // A page: network first, the kept copy if that fails, else the offline page.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (keepable(res)) {
          const copy = res.clone();
          event.waitUntil(caches.open(PAGES).then((c) => c.put(req, copy)).then(() => trim(PAGES, MAX_PAGES)));
        }
        return res;
      } catch {
        const c = await caches.open(PAGES);
        return (await c.match(req)) || (await c.match(req, { ignoreSearch: true })) || (await c.match(OFFLINE)) || Response.error();
      }
    })());
    return;
  }

  // Build files never change under the same name.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith((async () => {
      const c = await caches.open(BUILD);
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (keepable(res)) event.waitUntil(c.put(req, res.clone()));
      return res;
    })());
    return;
  }

  // Pictures: the kept copy straight away, a fresh one fetched behind it.
  if (url.pathname.startsWith('/_next/image') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/village/')) {
    event.respondWith((async () => {
      const c = await caches.open(PICTURES);
      const hit = await c.match(req);
      const fresh = fetch(req).then((res) => {
        if (keepable(res)) return c.put(req, res.clone()).then(() => trim(PICTURES, MAX_PICTURES)).then(() => res);
        return res;
      });
      if (hit) { event.waitUntil(fresh.catch(() => {})); return hit; }
      return fresh;
    })());
  }
});
