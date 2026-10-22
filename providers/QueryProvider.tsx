"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <PrivateCacheBoundary>{children}</PrivateCacheBoundary>
    </QueryClientProvider>
  );
}

function PrivateCacheBoundary({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (isPending) return;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) {
      queryClient.clear();
    }
    previousUserId.current = userId;
  }, [isPending, queryClient, userId]);

  useEffect(() => {
    const refreshProfiles = () =>
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    window.addEventListener("qchat:membership-changed", refreshProfiles);
    return () =>
      window.removeEventListener("qchat:membership-changed", refreshProfiles);
  }, [queryClient]);

  return children;
}
