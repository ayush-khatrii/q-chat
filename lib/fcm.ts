import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_APP_ID!,
};

export async function initFcm(userId: string): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !userId) {
    console.log("❌ FCM: browser not supported or no userId");
    return false;
  }

  console.log("📋 FCM: Starting init for user", userId);

  try {
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    console.log("📋 FCM: Registering service worker...");
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    console.log("✅ FCM: Service worker registered, scope:", registration.scope);

    console.log("📋 FCM: Requesting notification permission...");
    const permission = await Notification.requestPermission();
    console.log("📋 FCM: Permission result:", permission);

    if (permission !== "granted") {
      console.warn("❌ FCM: Permission not granted -", permission);
      return false;
    }

    console.log("📋 FCM: Getting FCM token with VAPID key...");
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_KEY;
    console.log("📋 FCM: VAPID key present?", !!vapidKey, "length:", vapidKey?.length);

    const token = await getToken(messaging, {
      vapidKey: vapidKey!,
      serviceWorkerRegistration: registration,
    });

    console.log("📋 FCM: Token received?", !!token, "preview:", token?.slice(0, 20) + "...");

    if (token) {
      console.log("📋 FCM: Saving token to server...");
      const res = await fetch("/api/fcm-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, token }),
      });
      const data = await res.json().catch(() => ({}));
      console.log("✅ FCM: Token saved, status:", res.status, "body:", data);
    } else {
      console.error("❌ FCM: getToken returned null/empty");
      return false;
    }

    onMessage(messaging, (payload) => {
      console.log("🔔 Foreground push received:", payload);
      // Show notification even in foreground
      if (Notification.permission === "granted" && payload.notification) {
        new Notification(payload.notification.title || "", {
          body: payload.notification.body,
          icon: "/logo.png",
        });
      }
    });

    console.log("✅ FCM: All done!");
    return true;
  } catch (error) {
    console.error("❌ FCM: init failed:", error);
    return false;
  }
}