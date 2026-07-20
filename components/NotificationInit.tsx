"use client";
import { useEffect } from "react";
import { initFcm } from "@/lib/fcm";
import { authClient } from "@/lib/auth-client";

export default function NotificationInit() {
  const { data: session } = authClient.useSession();

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    console.log("🔔 NotificationInit: user detected, starting FCM registration");
    initFcm(userId);
  }, [session?.user?.id]);

  return null;
}
