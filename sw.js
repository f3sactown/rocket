// Offline support. Network-first so app/program/library updates arrive as soon as
// you're online; the cached copy is used at a gloomy AO with no signal.
const CACHE = "f3qp-v28";
const SHELL = ["./", "index.html", "styles.css", "app.js", "data/library.js", "data/program.js", "data/roster.js", "data/attendance.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com");
  if (!sameOrigin && !isFont) return;
  // Same-origin files skip the browser's HTTP cache (GitHub Pages lets it keep files for
  // 10 minutes) and revalidate, so a deploy shows up on the next load, not 10 minutes later.
  e.respondWith(
    fetch(req, sameOrigin ? { cache: "no-cache" } : {}).then(res => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});
