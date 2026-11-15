// Rocket's service worker: shows push notifications and opens the right page when one is tapped.
// It doesn't cache anything; the app works as before without it.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const scope = self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(data.title || "Rocket", {
      body: data.body || "",
      icon: new URL("icons/icon-192.png", scope).href,
      // Android draws the small status-bar icon from its shape alone: a white rocket on clear.
      badge: new URL("icons/badge-96.png", scope).href,
      tag: data.tag,
      data: { url: new URL(data.url || "", scope).href },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Reuse a Rocket window that's already open, if there is one.
      const existing = open.find((c) =>
        c.url.startsWith(self.registration.scope),
      );
      if (existing) {
        await existing.focus();
        return existing.navigate(url);
      }
      return self.clients.openWindow(url);
    })(),
  );
});
