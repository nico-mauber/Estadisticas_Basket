const CACHE = "smart-basket-v10";
const STATIC = [
  "/",
  "/manifest.json",
  "/css/style.css",
  "/js/app.js",
  "/js/api.js",
  "/js/charts.js",
  "/js/chart.umd.min.js",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting(); // activate immediately, don't wait for old SW to die
});

self.addEventListener("activate", e => {
  // Delete all old caches
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.url.includes("/api/")) return;
  if (e.request.method !== "GET") return;

  // Network-first: durante desarrollo y después de un deploy se muestran los
  // archivos nuevos inmediatamente. El caché queda como respaldo offline.
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response.ok && new URL(e.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match("/")))
  );
});
