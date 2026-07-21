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
    const { title, body } = payload.notification || {};
    if (title) {
      self.registration.showNotification(title, {
        body: body || '',
        tag: 'qchat-msg',
        renotify: true,
      });
    }
  });

  console.log('✅ SW: Background message handler registered');
} catch (error) {
  console.error("❌ SW: Failed to initialize:", error);
}