"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import NotificationCenter from "@/components/NotificationCenter";
import UserDropdown from "@/components/auth/UserDropdown";

export default function AccountNavigation() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  if (!session || /^\/chat\/[^/]+\/?$/.test(pathname)) return null;
  return (
    <nav
      aria-label="Account navigation"
      className="sticky top-0 z-40 shrink-0 border-b bg-background/95 backdrop-blur"
    >
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-3 px-4">
        <Link
          href="/chat"
          className="flex items-center gap-2 rounded-md text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MessageCircle className="size-4 text-primary" />
          QChat
        </Link>
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <UserDropdown session={session} />
        </div>
      </div>
    </nav>
  );
}
