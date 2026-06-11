/* global firebase, self, clients */
// FCM background service worker — receives data-only pushes (the server sends
// data, not notification payloads, so display is fully controlled here and
// never double-fires) and shows the strike alert. Firebase config arrives via
// the registration URL's query string (set by usePushAlerts) so this static
// file never hardcodes project values.

importScripts("https://www.gstatic.com/firebasejs/12.1.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  storageBucket: params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  const title = d.title || "⛏ Hail Mary Prospecting Co.";
  self.registration.showNotification(title, {
    body: d.body || "Something happened on the field.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: d.tag || "hmpc-alert", // collapse repeats instead of stacking
    data: { url: d.url || "/hailmary" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/hailmary";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if (win.url.includes("/hailmary") && "focus" in win) return win.focus();
      }
      return clients.openWindow(url);
    })
  );
});
