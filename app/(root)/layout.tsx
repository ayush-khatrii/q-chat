import type { ReactNode } from "react";
import NotificationInit from "@/components/NotificationInit";
import SidebarLayout from "@/components/SidebarLayout";
import { SidebarProvider } from "@/components/sidebar-context";

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <NotificationInit />
      <main className="flex h-dvh flex-col">
        <SidebarLayout>{children}</SidebarLayout>
      </main>
    </SidebarProvider>
  );
}
