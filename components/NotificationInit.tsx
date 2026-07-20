"use client";
import { useEffect } from "react";
import { initFcm } from "@/lib/fcm";
import { authClient } from "@/lib/auth-client";

export default function NotificationInit() {
  const { data: session, isPending } = authClient.useSession();

  // Log on every render to confirm component is alive
  console.log("🔔 NotificationInit render:", {
    hasSession: !!session,
    userId: session?.user?.id,
    isPending,
  });

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      console.log("🔔 NotificationInit: no userId yet, waiting...");
      return;
    }

    console.log("🔔 NotificationInit: user detected, starting FCM registration");
    initFcm(userId).then((ok) => {
      console.log("🔔 NotificationInit: FCM registration result:", ok);
    });
  }, [session?.user?.id]);

  return null;
}
