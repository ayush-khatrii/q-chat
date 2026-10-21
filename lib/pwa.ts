"use client";

let registration: Promise<ServiceWorkerRegistration> | undefined;

export function registerAppWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  registration ??= navigator.serviceWorker
    .register("/firebase-messaging-sw.js", {
      scope: "/",
      updateViaCache: "none",
    })
    .catch((error) => {
      registration = undefined;
      throw error;
    });
  return registration;
}
