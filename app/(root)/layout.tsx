import type { ReactNode } from "react";
import NotificationInit from "@/components/NotificationInit";
import SidebarLayout from "@/components/SidebarLayout";
import { SidebarProvider } from "@/components/sidebar-context";
import QueryProvider from "@/providers/QueryProvider";

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <QueryProvider>
      <SidebarProvider>
        <NotificationInit />
        <main className="flex h-dvh flex-col">
          <SidebarLayout>{children}</SidebarLayout>
        </main>
      </SidebarProvider>
    </QueryProvider>
  );
}
