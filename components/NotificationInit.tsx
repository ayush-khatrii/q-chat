"use client";
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

export default function NotificationInit() {
  const { data: session } = authClient.useSession();

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    let cancelled = false;
    const initialize = () => {
      void import("@/lib/fcm")
        .then(({ initFcm }) => {
          if (!cancelled) void initFcm(userId);
        })
        .catch(() => {});
    };
    const supportsIdle = typeof window.requestIdleCallback === "function";
    const idleId = supportsIdle
      ? window.requestIdleCallback(initialize, { timeout: 2_000 })
      : window.setTimeout(initialize, 500);

    return () => {
      cancelled = true;
      if (supportsIdle) window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
    };
  }, [session?.user?.id]);

  return null;
}
