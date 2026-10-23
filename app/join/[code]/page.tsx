import AccountNavigation from "@/components/AccountNavigation";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRoomForMember } from "@/lib/room-service";
import { parseInviteCode } from "@/lib/invites";
import { privateMetadata } from "@/lib/site";
import InviteJoin from "@/components/rooms/InviteJoin";

export const metadata = {
  ...privateMetadata,
  title: "Join a room",
  description: "Sign in to join a QChat room.",
};
export default function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div
          className="mx-auto mt-16 w-full max-w-md space-y-4 rounded-2xl border p-6"
          aria-busy="true"
          aria-label="Loading invitation"
        >
          <div className="mx-auto size-12 animate-pulse rounded-full bg-muted" />
          <div className="mx-auto h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="mx-auto h-4 w-64 max-w-full animate-pulse rounded bg-muted/70" />
          <div className="h-10 animate-pulse rounded-md bg-muted" />
        </div>
      }
    >
      <Invitation params={params} />
    </Suspense>
  );
}
async function Invitation({ params }: { params: Promise<{ code: string }> }) {
  const code = parseInviteCode((await params).code);
  const session = await auth.api.getSession({ headers: await headers() });
  if (code && session?.user && (await getRoomForMember(code, session.user.id)))
    redirect(`/chat/${code}`);
  return (
    <>
      <AccountNavigation />
      <InviteJoin code={code} />
    </>
  );
}
