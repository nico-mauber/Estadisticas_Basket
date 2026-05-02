const CACHE = "courtiq-v1";
const STATIC = ["/", "/manifest.json", "/css/style.css", "/js/app.js", "/js/api.js"];

self.addEventListener("install", e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)))
);

self.addEventListener("fetch", e => {
  if (e.request.url.includes("/api/")) return; // always network for API
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
