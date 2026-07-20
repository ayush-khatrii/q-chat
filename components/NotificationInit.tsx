"use client";
import { useEffect } from "react";
import { initFcm } from "@/lib/fcm";

export default function NotificationInit({ userId }: { userId: string }) {
  useEffect(() => {
    initFcm(userId);
  }, [userId]);

  return null;
}