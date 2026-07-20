importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  // apiKey: "...",
  // authDomain: "...",
  // projectId: "...",
  // storageBucket: "...",
  // messagingSenderId: "...",
  // appId: "...",
  apiKey: "AIzaSyBWztykOT4DrhpojTVKLreC77p-cNlbDqs",
  authDomain: "q-chat-81181.firebaseapp.com",
  projectId: "q-chat-81181",
  storageBucket: "q-chat-81181.firebasestorage.app",
  messagingSenderId: "711427154982",
  appId: "1:711427154982:web:e82386364d2a1c2aec32e7",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/logo.png',
  });
});