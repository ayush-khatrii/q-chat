"use client";

import { Check, ShieldCheck, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useDecideRoomRequest,
  useRoomJoinRequests,
  useRoomRequestEvents,
} from "@/hooks/use-room-requests";

function displayName(user: { name: string | null; email: string }) {
  return user.name ?? user.email;
}

function initials(value: string) {
  return value
    .split(/\s|@/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function RoomJoinRequestsPanel({
  roomId,
  ownerId,
  isOwner,
}: {
  roomId: string;
  ownerId: string;
  isOwner: boolean;
}) {
  const requestsQuery = useRoomJoinRequests(roomId, isOwner);
  const decideRequest = useDecideRoomRequest(roomId);
  useRoomRequestEvents({
    roomId,
    userId: ownerId,
    ownerEnabled: isOwner,
  });

  if (!isOwner) {
    return null;
  }

  const requests = requestsQuery.data?.requests ?? [];

  return (
    <div>
      <button
        type="button"
        className="flex min-h-9 w-full items-center gap-3 px-3 text-left text-xs font-medium hover:bg-accent hover:text-accent-foreground"
        onClick={() => requestsQuery.refetch()}
      >
        <ShieldCheck className="size-3.5 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">Join requests</span>
        {requests.length > 0 ? (
          <Badge variant="destructive" className="h-5 min-w-5 justify-center px-1 text-[10px]">
            {requests.length}
          </Badge>
        ) : null}
      </button>

      <div className="border-t px-3 py-2">
        {requestsQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading requests…</p>
        ) : requestsQuery.isError ? (
          <p className="text-xs text-destructive">
            {requestsQuery.error instanceof Error
              ? requestsQuery.error.message
              : "Unable to load requests."}
          </p>
        ) : requests.length === 0 ? (
          <p className="text-xs text-muted-foreground">No pending requests.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((request) => {
              const name = displayName(request.user);
              const isBusy =
                decideRequest.isPending &&
                decideRequest.variables?.memberId === request.id;

              return (
                <div key={request.id} className="rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      <AvatarImage src={request.user.image ?? undefined} alt={name} />
                      <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        Requested {new Date(request.requestedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={isBusy}
                      onClick={() =>
                        decideRequest.mutate({
                          memberId: request.id,
                          status: "APPROVED",
                        })
                      }
                    >
                      <Check className="size-3" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={isBusy}
                      onClick={() =>
                        decideRequest.mutate({
                          memberId: request.id,
                          status: "REJECTED",
                        })
                      }
                    >
                      <X className="size-3" />
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
