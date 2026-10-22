const V = "novel-v1", CORE = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if(r.method !== "GET" || u.origin !== location.origin) return;
  if(r.mode === "navigate"){
    e.respondWith(fetch(r).then(x => { const cp = x.clone(); caches.open(V).then(c => c.put("index.html", cp)); return x; }).catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(r).then(hit => {
    const net = fetch(r).then(x => { if(x.ok){ const cp = x.clone(); caches.open(V).then(c => c.put(r, cp)); } return x; }).catch(() => hit);
    return hit || net;
  }));
});
