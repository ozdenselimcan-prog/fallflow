/* FallFlow Service Worker: zeigt Push-Benachrichtigungen (Notfälle, gebuchte Termine) und öffnet beim Antippen den Fall. */
self.addEventListener("push", (event) => {
  let data = { title: "FallFlow", body: "", url: "/dashboard" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/icon.png", badge: "/icon.png", data: { url: data.url }, tag: data.url, renotify: true }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
