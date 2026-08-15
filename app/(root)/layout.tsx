import type { ReactNode } from "react";
import NotificationInit from "@/components/NotificationInit";
import SidebarLayout from "@/components/SidebarLayout";
import { SidebarProvider } from "@/components/sidebar-context";
import { ChatAppearanceProvider } from "@/components/chat/chat-appearance";

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ChatAppearanceProvider>
      <SidebarProvider>
        <NotificationInit />
        <main className="flex h-dvh flex-col">
          <SidebarLayout>{children}</SidebarLayout>
        </main>
      </SidebarProvider>
    </ChatAppearanceProvider>
  );
}
