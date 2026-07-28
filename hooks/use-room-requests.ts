"use client";

import { useCallback } from "react";
import { useChannel } from "ably/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ownerRequestEventsChannel,
  userRequestStatusChannel,
} from "@/lib/room-event-channels";

type RoomJoinRequest = {
  id: string;
  requestedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

type MembershipResponse = {
  membership: {
    id: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    roomId: string;
    roomCode: string;
    roomName: string;
  };
};

async function readJson<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as
    | T
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "error" in payload
        ? payload.error ?? "Request failed."
        : "Request failed.",
    );
  }

  return payload as T;
}

export function useRoomJoinRequests(roomId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["room-requests", roomId],
    queryFn: () =>
      readJson<{ requests: RoomJoinRequest[] }>(
        `/api/rooms/${roomId}/requests`,
      ),
    enabled,
    // Ably events invalidate this query immediately. This slow fallback covers
    // a temporarily disconnected browser without high-frequency polling.
    refetchInterval: (query) =>
      query.state.data ? 60_000 : false,
  });
}

export function useRoomMembership(roomId: string | null) {
  return useQuery({
    queryKey: ["room-membership", roomId],
    queryFn: () =>
      readJson<MembershipResponse>(`/api/rooms/${roomId}/membership`),
    enabled: Boolean(roomId),
    refetchInterval: (query) =>
      query.state.data?.membership.status === "PENDING" ? 60_000 : false,
  });
}

export function useDecideRoomRequest(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      status,
    }: {
      memberId: string;
      status: "APPROVED" | "REJECTED";
    }) =>
      readJson<{ request: { id: string; status: string } }>(
        `/api/rooms/${roomId}/requests/${memberId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["room-requests", roomId],
      });
    },
  });
}

export function useRoomRequestEvents({
  roomId,
  userId,
  ownerEnabled,
  requesterEnabled,
}: {
  roomId?: string | null;
  userId?: string | null;
  ownerEnabled?: boolean;
  requesterEnabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const ownerChannelName = userId
    ? ownerRequestEventsChannel(userId)
    : "qchat:disabled-owner-requests";
  const requesterChannelName = userId
    ? userRequestStatusChannel(userId)
    : "qchat:disabled-request-status";

  const handleOwnerEvent = useCallback(() => {
    if (roomId) {
      void queryClient.invalidateQueries({
        queryKey: ["room-requests", roomId],
      });
    }
  }, [queryClient, roomId]);

  const handleRequesterEvent = useCallback(
    (message: { data?: unknown }) => {
      const data = message.data;
      const eventRoomId =
        data &&
        typeof data === "object" &&
        "roomId" in data &&
        typeof data.roomId === "string"
          ? data.roomId
          : null;

      if (eventRoomId) {
        void queryClient.invalidateQueries({
          queryKey: ["room-membership", eventRoomId],
        });
      }
    },
    [queryClient],
  );

  useChannel(
    { channelName: ownerChannelName, skip: !ownerEnabled },
    "join-request.created",
    handleOwnerEvent,
  );
  useChannel(
    { channelName: ownerChannelName, skip: !ownerEnabled },
    "join-request.updated",
    handleOwnerEvent,
  );
  useChannel(
    { channelName: requesterChannelName, skip: !requesterEnabled },
    "join-request.updated",
    handleRequesterEvent,
  );
}

export type { RoomJoinRequest };
