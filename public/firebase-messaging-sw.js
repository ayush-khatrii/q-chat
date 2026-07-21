// QChat SW v2 — data-only, single notification, custom icon
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

try {
  firebase.initializeApp({
    apiKey: "AIzaSyBWztykOT4DrhpojTVKLreC77p-cNlbDqs",
    authDomain: "q-chat-81181.firebaseapp.com",
    projectId: "q-chat-81181",
    storageBucket: "q-chat-81181.firebasestorage.app",
    messagingSenderId: "711427154982",
    appId: "1:711427154982:web:e82386364d2a1c2aec32e7",
  });

  console.log("✅ SW: Firebase initialized");

  const messaging = firebase.messaging();

  // Only ONE handler: Firebase's onBackgroundMessage handles everything
  messaging.onBackgroundMessage((payload) => {
    console.log('🔔 SW: Background message received:', payload);
    // Read from data (we send data-only to avoid double notifications from Firebase auto-display)
    const title = payload.data?.title || payload.notification?.title;
    const body = payload.data?.body || payload.notification?.body || '';
    const roomCode = payload.data?.roomCode || '';
    if (title) {
      self.registration.showNotification(title, {
        body: body,
        icon: '/logo-1.png',
        badge: '/logo-1.png',
        tag: 'qchat-msg',
        renotify: true,
        data: { roomCode },
      });
    }
  });

  console.log('✅ SW: Background message handler registered');

  // Handle notification click — open the app and navigate to the room
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = new URL(
      event.notification.data?.roomCode
        ? `/chat/${event.notification.data.roomCode}`
        : '/',
      self.location.origin,
    ).href;

    event.waitUntil(
      clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((windows) => {
          const existing = windows.find((c) => c.url.includes(self.location.origin) && 'focus' in c);
          if (existing) {
            existing.focus();
            existing.navigate(url);
          } else {
            clients.openWindow(url);
          }
        }),
    );
  });

  console.log('✅ SW: Notification click handler registered');
} catch (error) {
  console.error("❌ SW: Failed to initialize:", error);
}