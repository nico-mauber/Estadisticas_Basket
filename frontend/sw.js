const CACHE = "smart-basket-v41";
const STATIC = [
  "/",
  "/manifest.json",
  "/css/style.css",
  "/js/app.js",
  "/js/api.js",
  "/js/charts.js",
  "/js/core/format.js",
  "/js/core/prefs.js",
  "/js/core/catalog.js",
  "/js/core/colors.js",
  "/js/core/base.js",
  "/js/core/context.js",
  "/js/components/context-bar.js",
  "/js/components/period-block.js",
  "/js/components/lineups-block.js",
  "/js/components/compare-players.js",
  "/js/components/identity-merge.js",
  "/js/components/settings-form.js",
  "/js/components/standard-panel.js",
  "/js/components/sample-badge.js",
  "/js/components/metric-card.js",
  "/js/components/data-table.js",
  "/js/components/export-menu.js",
  "/js/components/exporters.js",
  "/js/components/shot-chart.js",
  "/js/components/game-view.js",
  "/js/components/game-report.js",
  "/js/components/live-view.js",
  "/js/components/momentum-panel.js",
  "/js/components/prepare-report.js",
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
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
