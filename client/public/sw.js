const CACHE = "nuvora-shell-v2";
const SHELL = ["/", "/manifest.json", "/favicon.svg", "/nuvora-icon.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === "navigate") event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(cached => cached || caches.match("/"))));
});
self.addEventListener("push", event => {
  const payload = event.data ? event.data.json() : { title: "Nuvora", body: "You have a new update.", url: "/notifications" };
  event.waitUntil(self.registration.showNotification(payload.title || "Nuvora", { body: payload.body || "You have a new update.", icon: "/nuvora-icon.png", data: { url: payload.url || "/notifications" } }));
});
self.addEventListener("notificationclick", event => { event.notification.close(); event.waitUntil(clients.openWindow(event.notification.data?.url || "/notifications")); });
