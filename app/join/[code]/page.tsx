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
    <Suspense fallback={<p className="p-8">Loading invitation…</p>}>
      <Invitation params={params} />
    </Suspense>
  );
}
async function Invitation({ params }: { params: Promise<{ code: string }> }) {
  const code = parseInviteCode((await params).code);
  const session = await auth.api.getSession({ headers: await headers() });
  if (code && session?.user && (await getRoomForMember(code, session.user.id)))
    redirect(`/chat/${code}`);
  return <InviteJoin code={code} />;
}
