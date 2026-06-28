"use client";

import * as React from "react";
import { useSidebar } from "@/components/sidebar-context";
import ChatMembersSidebar from "@/components/ChatMemberSidebar";

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { open, setOpen } = useSidebar();

  return (
    <div className="flex flex-1 min-h-0">
      <ChatMembersSidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex flex-1 flex-col min-w-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
