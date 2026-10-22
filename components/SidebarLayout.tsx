"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/components/sidebar-context";
import ChatMembersSidebar from "@/components/ChatMemberSidebar";

function RouteAwareChatSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const isRoomDirectory = usePathname() === "/chat";
  return isRoomDirectory ? null : (
    <ChatMembersSidebar open={open} onClose={onClose} />
  );
}

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { open, setOpen } = useSidebar();

  return (
    <div className="flex flex-1 min-h-0">
      <React.Suspense fallback={null}>
        <RouteAwareChatSidebar open={open} onClose={() => setOpen(false)} />
      </React.Suspense>
      <div className="flex flex-1 flex-col min-w-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
